import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

const baseDir = process.env.GITHUB_WORKSPACE || process.cwd();
const configPath = path.join(baseDir, '.github', 'mcp-servers', 'agent-manager', 'config.json');
const stateDir = path.join(baseDir, '_tmp', 'agent_state');

// --- Helper function for reading state ---

async function readAgentState(agentId) {
    const filePath = path.join(stateDir, `${agentId}_state.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null; // File does not exist, which is a valid state
        }
        throw error; // Other errors should be thrown
    }
}

class AgentManager {
  constructor(config) {
    this.config = config;
    // USE task_id as the key to allow multiple concurrent runs per agent
    this.agent_processes = new Map();
  }

  async spawnAgentProcess(agent_id, prompt, task_id) {
    const baseDir = process.env.GITHUB_WORKSPACE || process.cwd();
    const templatePath = path.join(baseDir, '.github', 'mcp-servers', 'agent-manager', 'prompt-templates', `${agent_id}.md`);

    try {
      let template = await fs.readFile(templatePath, 'utf8');
      const finalPrompt = template
        .replace('{{task_requirements}}', prompt)
        .replace('{{agent_id}}', agent_id)
        .replace('{{task_id}}', task_id);

      const allowedTools = this.config.permissions.allowed_tools.join(' ');
      const disallowedTools = this.config.permissions.disallowed_tools.join(' ');

      const logPath = path.join(stateDir, `${agent_id}_log.jsonl`);
      const startTime = new Date().toISOString();
      
      // This is the SINGLE stream for this entire process run
      const logStream = createWriteStream(logPath, { flags: 'a' });

      // --- Log the "started" event immediately ---
      const startEntry = { task_id, agent_id, event: 'started', timestamp: startTime };
      logStream.write(JSON.stringify(startEntry) + '\n');
      
      const outputChunks = [];

      const child = spawn('docker', [
        'exec',
        'claude-code',
        'claude',
        '--output-format', 'json',
        '--allowedTools', allowedTools,
        '--disallowedTools', disallowedTools,
        '-p',
        finalPrompt
      ], {
        detached: true,
        // Pipe output to be captured, not directly to the file
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // --- Store the PID using task_id as key ---
      this.agent_processes.set(task_id, child.pid);
      console.log(`Spawned agent for task ${task_id} with PID ${child.pid}`);

      // --- Capture output in memory ---
      child.stdout.on('data', (data) => {
        outputChunks.push({ type: 'stdout', timestamp: new Date().toISOString(), data: data.toString() });
      });
      child.stderr.on('data', (data) => {
        outputChunks.push({ type: 'stderr', timestamp: new Date().toISOString(), data: data.toString() });
      });

      child.unref();

      // --- Correct 'exit' handler ---
      child.on('exit', (code) => {
        // Clean up the PID from the map
        this.agent_processes.delete(task_id);
        console.log(`Agent for task ${task_id} (PID: ${child.pid}) has exited.`);

        // Write the final, comprehensive log entry
        const finalLogEntry = {
          task_id,
          agent_id,
          event: 'exited',
          start_time: startTime,
          end_time: new Date().toISOString(),
          exit_code: code,
          output: outputChunks
        };
        
        // Use the ORIGINAL stream to write the final entry and then close it
        logStream.write(JSON.stringify(finalLogEntry) + '\n');
        logStream.end();
      });

    } catch (error) {
      console.error(`Failed to read or process prompt template for ${agent_id}:`, error);
    }
  }
}

async function initializeState(config) {
    await fs.mkdir(stateDir, { recursive: true });

    for (const agentId in config.agents) {
        const filePath = path.join(stateDir, `${agentId}_state.json`);
        try {
            await fs.access(filePath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File does not exist, create it
                const initialState = {
                    id: agentId,
                    status: 'available',
                    description: config.agents[agentId].description,
                    current_task: null,
                    last_activity: null,
                    plan: null,
                    progress: null,
                };
                await fs.writeFile(filePath, JSON.stringify(initialState, null, 2), 'utf8');
                console.error(`Initialized state file for ${agentId}.`);
            } else {
                throw error;
            }
        }
    }
}

async function main() {
  try {
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);

    await initializeState(config);

    const agentManager = new AgentManager(config);

    const server = new McpServer({
      name: 'agent_manager',
      version: '1.0.0',
    });

    // Orchestrator Tools
    server.registerTool(
      'list_agents',
      {
        title: 'List Agents',
        description: 'Get the current status of all available agents.',
        inputSchema: {},
      },
      async () => {
        const agents = [];
        for (const agentId in config.agents) {
            const agentState = await readAgentState(agentId);
            // Check if any task for this agent is running
            const processInfo = Array.from(agentManager.agent_processes.entries())
              .find(([taskId, pid]) => taskId.startsWith(`${agentId}_`));
            const isRunning = !!processInfo;
            
            if (agentState) {
                // Add runtime status
                agents.push({
                    ...agentState,
                    is_running: isRunning,
                    process_info: processInfo ? { pid: processInfo[1], task_id: processInfo[0] } : null
                });
            } else {
                // If state file doesn't exist, report as available
                agents.push({
                    id: agentId,
                    status: 'available',
                    description: config.agents[agentId].description,
                    current_task: null,
                    last_activity: null,
                    is_running: false,
                    process_info: null
                });
            }
        }
        return { content: [{ type: 'text', text: JSON.stringify({ agents }, null, 2) }] };
      }
    );

    server.registerTool(
      'run_agent',
      {
        title: 'Run Agent',
        description: 'Assign a task to a specific agent.',
        inputSchema: {
          agent: z.string().describe('The ID of the agent to run (e.g., "swe_agent").'),
          prompt: z.string().describe('The high-level goal for the agent.'),
        },
      },
      async ({ agent, prompt }) => {
        const targetAgentState = await readAgentState(agent);

        if (targetAgentState && targetAgentState.status !== 'available') {
          return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Agent ${agent} is currently busy.`}) }] };
        }

        const taskId = `${agent}_${Date.now()}`;

        // Immediately update agent status to prevent race conditions
        const updatedState = targetAgentState || {
          id: agent,
          status: 'available',
          description: config.agents[agent].description,
          current_task: null,
          last_activity: null,
          plan: null,
          progress: null,
        };

        updatedState.status = 'in_progress';
        updatedState.current_task = taskId;
        updatedState.last_activity = new Date().toISOString();
        await fs.writeFile(path.join(stateDir, `${agent}_state.json`), JSON.stringify(updatedState, null, 2), 'utf8');

        agentManager.spawnAgentProcess(agent, prompt, taskId);

        return { content: [{ type: 'text', text: JSON.stringify({ success: true, agent: agent, task_id: taskId, status: 'running', message: 'Agent process started in the background.'}) }] };
      }
    );

    server.registerTool(
      'status',
      {
          title: 'Get Agent Status',
          description: "Check an agent's current status.",
          inputSchema: { agent: z.string().describe("The agent's ID.") },
      },
      async ({ agent }) => {
          const targetAgent = await readAgentState(agent);
          
          // Check if there's actually a running process for this agent
          const processInfo = Array.from(agentManager.agent_processes.entries())
            .find(([taskId, pid]) => taskId.startsWith(`${agent}_`));
          const isRunning = !!processInfo;
          
          if (!targetAgent) {
            return { 
              content: [{ 
                type: 'text', 
                text: JSON.stringify({ 
                  id: agent, 
                  status: 'available', 
                  is_running: false,
                  message: "State file not found, assuming available."
                }) 
              }] 
            };
          }
          
          // Update status based on actual running process
          const actualStatus = {
            ...targetAgent,
            is_running: isRunning,
            actual_status: isRunning ? 'running' : targetAgent.status,
            process_info: processInfo ? {
              pid: processInfo[1],
              task_id: processInfo[0]
            } : null
          };
          
          // If state says "in_progress" but no process is running, it might have crashed
          if (targetAgent.status === 'in_progress' && !isRunning) {
            actualStatus.status_mismatch = true;
            actualStatus.likely_crashed = true;
          }
          
          return { 
            content: [{ 
              type: 'text', 
              text: JSON.stringify(actualStatus, null, 2) 
            }] 
          };
      }
    );

    server.registerTool(
      'get_plan',
      {
        title: 'Get Agent Plan',
        description: "Retrieve an agent's current strategic plan.",
        inputSchema: { agent: z.string().describe("The agent's ID.") },
      },
      async ({ agent }) => {
        const targetAgent = await readAgentState(agent);
        if (!targetAgent) {
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `State file for agent ${agent} not found.`}) }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ agent: agent, plan: targetAgent.plan }, null, 2) }] };
      }
    );

    server.registerTool(
      'get_progress',
      {
        title: 'Get Agent Progress',
        description: "Retrieve an agent's current task progress.",
        inputSchema: { agent: z.string().describe("The agent's ID.") },
      },
      async ({ agent }) => {
        const targetAgent = await readAgentState(agent);
        if (!targetAgent) {
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `State file for agent ${agent} not found.`}) }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ agent: agent, progress: targetAgent.progress }, null, 2) }] };
      }
    );

    server.registerTool(
      'terminate_agent',
      {
        title: 'Terminate a Running Agent Task',
        description: 'Forcibly stops a running agent process based on its task ID.',
        inputSchema: {
          task_id: z.string().describe('The specific task ID of the agent process to terminate.'),
        },
      },
      async ({ task_id }) => {
        const pid = agentManager.agent_processes.get(task_id);
        
        if (!pid) {
          return { 
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                success: false, 
                message: `No running process found for task ${task_id}` 
              })
            }]
          };
        }

        try {
          // This is sufficient. Killing the host 'docker exec' process
          // sends SIGTERM to the 'claude' process inside the container.
          process.kill(pid, 'SIGTERM');
          
          agentManager.agent_processes.delete(task_id);
          
          // Extract agent_id from task_id (format: agent_timestamp)
          const agent_id = task_id.split('_')[0];
          
          // Update agent state
          const agentState = await readAgentState(agent_id);
          if (agentState) {
            agentState.status = 'available';
            agentState.current_task = null;
            agentState.last_activity = new Date().toISOString();
            await fs.writeFile(
              path.join(stateDir, `${agent_id}_state.json`), 
              JSON.stringify(agentState, null, 2), 
              'utf8'
            );
          }
          
          return { 
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                success: true, 
                message: `Task ${task_id} terminated`,
                pid: pid
              })
            }]
          };
        } catch (error) {
          return { 
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                success: false, 
                message: `Failed to terminate task: ${error.message}` 
              })
            }]
          };
        }
      }
    );

    // --- Worker Tools ---

    server.registerTool(
      'update_plan',
      {
        title: 'Update Agent Plan',
        description: 'Allows an agent to update its strategic plan.',
        inputSchema: {
          agent_id: z.string().describe('The ID of the agent updating the plan.'),
          plan: z.any().describe('The plan object.')
        },
      },
      async ({ agent_id, plan }) => {
        const agent = await readAgentState(agent_id);
        if (!agent) {
             return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `State file for agent ${agent_id} not found.`}) }] };
        }
        agent.plan = plan;
        agent.status = 'in_progress'; // Set status to in_progress when plan is updated
        agent.last_activity = new Date().toISOString();
        await fs.writeFile(path.join(stateDir, `${agent_id}_state.json`), JSON.stringify(agent, null, 2), 'utf8');
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Plan updated.'}) }] };
      }
    );

    server.registerTool(
      'update_progress',
      {
        title: 'Update Agent Progress',
        description: 'Allows an agent to update its task progress.',
        inputSchema: {
          agent_id: z.string().describe('The ID of the agent updating the progress.'),
          progress: z.any().describe('The progress object.')
        },
      },
      async ({ agent_id, progress }) => {
        const agent = await readAgentState(agent_id);
        if (!agent) {
             return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `State file for agent ${agent_id} not found.`}) }] };
        }
        agent.progress = progress;
        agent.last_activity = new Date().toISOString();

        if (progress.overall_progress >= 1.0 || progress.status === 'completed') {
            agent.status = 'available';
            agent.current_task = null;
        }

        await fs.writeFile(path.join(stateDir, `${agent_id}_state.json`), JSON.stringify(agent, null, 2), 'utf8');

        return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Progress updated.'}) }] };
      }
    );

    server.registerTool(
      'get_agent_logs',
      {
        title: 'Get Agent Logs',
        description: 'Retrieve logs from an agent\'s execution history.',
        inputSchema: {
          agent_id: z.string().describe('The ID of the agent whose logs to retrieve.'),
          task_id: z.string().optional().describe('Optional: specific task ID to filter by.'),
          last_n: z.number().optional().default(10).describe('Number of most recent log entries to return (default: 10).'),
        },
      },
      async ({ agent_id, task_id, last_n }) => {
        const logPath = path.join(stateDir, `${agent_id}_log.jsonl`);
        
        try {
          const logContent = await fs.readFile(logPath, 'utf8');
          const lines = logContent.trim().split('\n').filter(line => line);
          
          let logEntries = [];
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (!task_id || entry.task_id === task_id) {
                logEntries.push(entry);
              }
            } catch (parseError) {
              console.error('Failed to parse log line:', parseError);
            }
          }
          
          // Get the last N entries
          const recentEntries = logEntries.slice(-last_n);
          
          return { 
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                agent_id,
                total_entries: logEntries.length,
                returned_entries: recentEntries.length,
                logs: recentEntries
              }, null, 2)
            }]
          };
        } catch (error) {
          if (error.code === 'ENOENT') {
            return { 
              content: [{ 
                type: 'text', 
                text: JSON.stringify({ 
                  success: false, 
                  message: `No log file found for agent ${agent_id}` 
                })
              }]
            };
          }
          // Return error message instead of throwing
          return { 
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                success: false, 
                message: `Error reading log file: ${error.message}` 
              })
            }]
          };
        }
      }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("Agent Manager MCP Server connected and listening via stdio.");

  } catch (e) {
    console.error("Agent Manager MCP Server failed to start:", e);
    process.exit(1);
  }
}

main();
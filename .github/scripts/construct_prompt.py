import os
import sys
import json

def format_issue_context(github_data):
    """Format GitHub issue context for the prompt."""
    return f"""
<formatted_context>
Issue Title: {github_data.get('title', 'N/A')}
Issue Author: {github_data.get('user', {}).get('login', 'N/A')}
Issue State: {github_data.get('state', 'N/A').upper()}
Issue Number: {github_data.get('number', 'N/A')}
Repository: {os.environ.get('GITHUB_REPOSITORY', 'N/A')}
</formatted_context>

<pr_or_issue_body>
{github_data.get('body', 'No description provided')}
</pr_or_issue_body>

<comments>
No comments (will be fetched by claude-code-action if needed)
</comments>

<event_type>ISSUE_LABELED</event_type>
<is_pr>false</is_pr>
<trigger_context>issue labeled with 'claude-task'</trigger_context>
<repository>{os.environ.get('GITHUB_REPOSITORY', 'N/A')}</repository>
<issue_number>{github_data.get('number', 'N/A')}</issue_number>
"""

def format_pr_context(github_data):
    """Format GitHub pull request context for the prompt."""
    return f"""
<formatted_context>
PR Title: {github_data.get('title', 'N/A')}
PR Author: {github_data.get('user', {}).get('login', 'N/A')}
PR State: {github_data.get('state', 'N/A').upper()}
PR Number: {github_data.get('number', 'N/A')}
Source Branch: {github_data.get('head', {}).get('ref', 'N/A')}
Target Branch: {github_data.get('base', {}).get('ref', 'N/A')}
Repository: {os.environ.get('GITHUB_REPOSITORY', 'N/A')}
</formatted_context>

<pr_or_issue_body>
{github_data.get('body', 'No description provided')}
</pr_or_issue_body>

<comments>
No comments (will be fetched by claude-code-action if needed)
</comments>

<event_type>PR_OPENED</event_type>
<is_pr>true</is_pr>
<trigger_context>pull request opened or updated</trigger_context>
<repository>{os.environ.get('GITHUB_REPOSITORY', 'N/A')}</repository>
<pr_number>{github_data.get('number', 'N/A')}</pr_number>
"""

def construct_prompt():
    """
    Constructs the final prompt by reading the template and injecting GitHub context.
    Handles both issue and PR contexts.
    """
    # Handle both issue and PR contexts
    issue_context = os.environ.get('ISSUE_CONTEXT')
    pr_context = os.environ.get('PR_CONTEXT')
    
    # Filter out null/empty values
    if issue_context and issue_context.lower() not in ['null', 'none', '']:
        try:
            context_data = json.loads(issue_context)
            if context_data is None:
                raise ValueError("Parsed data is None")
            context_type = "ISSUE"
            template_path = ".github/prompts/issue-handle-prompt.txt"
            output_dir = "_tmp/orchestrator"
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Error: Invalid ISSUE_CONTEXT: {e}", file=sys.stderr)
            sys.exit(1)
    elif pr_context and pr_context.lower() not in ['null', 'none', '']:
        try:
            context_data = json.loads(pr_context)
            if context_data is None:
                raise ValueError("Parsed data is None")
            context_type = "PR"
            template_path = ".github/prompts/pr-review-prompt.txt"
            output_dir = "_tmp/pr-reviewer"
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Error: Invalid PR_CONTEXT: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Error: Neither ISSUE_CONTEXT nor PR_CONTEXT environment variable is set with valid data.", file=sys.stderr)
        print(f"ISSUE_CONTEXT: {issue_context}", file=sys.stderr)
        print(f"PR_CONTEXT: {pr_context}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(template_path, 'r') as f:
            template = f.read()
    except FileNotFoundError:
        print(f"Error: Template not found at {template_path}", file=sys.stderr)
        sys.exit(1)

    # Format context based on type
    if context_type == "ISSUE":
        github_context = format_issue_context(context_data)
    else:  # PR
        github_context = format_pr_context(context_data)

    # Perform the substitution
    final_prompt = template.replace('{{GITHUB_CONTEXT}}', github_context)
    
    # Replace PR_NUMBER placeholder if it's a PR context
    if context_type == "PR":
        pr_number = context_data.get('number', 'N/A')
        final_prompt = final_prompt.replace('{{PR_NUMBER}}', str(pr_number))

    # Save the prompt for the hijacker to use
    os.makedirs(output_dir, exist_ok=True)
    prompt_path = f'{output_dir}/prompt.txt'
    with open(prompt_path, 'w') as f:
        f.write(final_prompt)

    print(f"✅ {context_type} prompt prepared for hijacking at: {prompt_path}")

    # Write the prompt path to GitHub Actions output
    output_file = os.environ.get('GITHUB_OUTPUT')
    if output_file:
        with open(output_file, 'a') as f:
            if context_type == "ISSUE":
                f.write(f"orchestrator_prompt_path={prompt_path}\n")
            else:
                f.write(f"pr_reviewer_prompt_path={prompt_path}\n")

    return prompt_path

if __name__ == "__main__":
    construct_prompt()

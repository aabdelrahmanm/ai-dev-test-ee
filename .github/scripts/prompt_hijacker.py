#!/usr/bin/env python3
"""
Background process that monitors and hijacks claude-code-action's prompt file
"""
import os
import sys
import time
import shutil
from pathlib import Path

def hijack_prompt_file():
    """
    Continuously monitor for the library's prompt file and replace it with ours
    """
    # Path where the library will write its prompt
    library_prompt_path = f"{os.environ.get('RUNNER_TEMP', '/tmp')}/claude-prompts/claude-prompt.txt"

    # Paths to our possible prompt files
    our_prompt_path_orchestrator = "_tmp/orchestrator/prompt.txt"
    our_prompt_path_pr_reviewer = "_tmp/pr-reviewer/prompt.txt"

    our_prompt_path = None
    if os.path.exists(our_prompt_path_pr_reviewer):
        our_prompt_path = our_prompt_path_pr_reviewer
    elif os.path.exists(our_prompt_path_orchestrator):
        our_prompt_path = our_prompt_path_orchestrator

    if not our_prompt_path:
        print(f"❌ Our prompt not found at either '{our_prompt_path_orchestrator}' or '{our_prompt_path_pr_reviewer}'")
        sys.exit(1)

    print(f"🎯 Starting prompt hijacker...")
    print(f"📍 Monitoring: {library_prompt_path}")
    print(f"📁 Our prompt: {our_prompt_path}")

    # Create the directory structure if it doesn't exist
    os.makedirs(os.path.dirname(library_prompt_path), exist_ok=True)

    # Pre-place our prompt
    shutil.copy2(our_prompt_path, library_prompt_path)
    print(f"✅ Pre-placed our orchestrator prompt")

    # Monitor and replace continuously for 5 minutes
    start_time = time.time()
    check_count = 0

    while time.time() - start_time < 300:  # 5 minutes timeout
        try:
            if os.path.exists(library_prompt_path):
                # Check if the file contains our content or library content
                with open(library_prompt_path, 'r') as f:
                    current_content = f.read()

                with open(our_prompt_path, 'r') as f:
                    our_content = f.read()

                # If the content doesn't match ours, replace it
                if current_content != our_content:
                    print(f"🔄 Library overwrote prompt! Hijacking back... (check #{check_count})")
                    shutil.copy2(our_prompt_path, library_prompt_path)
                    print(f"✅ Restored orchestrator prompt")

                check_count += 1
                if check_count % 100 == 0:
                    print(f"📊 Performed {check_count} hijack checks...")

            time.sleep(0.1)  # Check every 100ms

        except Exception as e:
            print(f"⚠️ Error during hijack: {e}")
            time.sleep(1)

    print(f"🏁 Hijacker completed after {check_count} checks")

if __name__ == "__main__":
    hijack_prompt_file()

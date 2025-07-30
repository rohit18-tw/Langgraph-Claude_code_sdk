from dotenv import load_dotenv
import os

load_dotenv()  # This loads the .env file

# claude_helper.py
import asyncio
from claude_code_sdk import query, ClaudeCodeOptions

async def ask_claude_simple(prompt: str) -> str:
    """Get just the final result from Claude"""
    async for message in query(
        prompt=prompt,
        options=ClaudeCodeOptions(
            max_turns=3,
            permission_mode="acceptEdits"  # This avoids permission prompts
        )
    ):
        # Only return the final result
        if hasattr(message, 'subtype') and message.subtype == 'success':
            return message.result

    return "No result received"

def ask_claude(prompt: str) -> str:
    """Synchronous wrapper"""
    return asyncio.run(ask_claude_simple(prompt))

# Test it
if __name__ == "__main__":
    # This will give you just the final answer
    result = ask_claude("Write a Python function to calculate factorial")
    print("Final Result:")
    print(result)



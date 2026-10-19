#!/bin/zsh -l
# Double-click to install dependencies, run checks and start Claude Code in this project.
cd "$(dirname "$0")"
echo "▶ Installing dependencies…"
npm install --no-fund --no-audit || { echo "npm install failed — see above"; exec $SHELL; }
echo "▶ Type check + tests…"
npm run typecheck && npm test
echo "▶ Starting Claude Code…"
if command -v claude >/dev/null 2>&1; then
  claude "Read CLAUDE.md, confirm typecheck and tests pass (fix anything that fails), then plan how to implement the eazyBI snapshot adapter."
else
  echo "Claude Code CLI not found. Install it with:  npm install -g @anthropic-ai/claude-code   then run: claude"
  exec $SHELL
fi

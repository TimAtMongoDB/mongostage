# Component fragment: Claude Code CLI
# Requires a node-capable base layer (FROM must include Node.js)
# FROM resolved by build command - only valid on node-* images

USER root
RUN npm install -g @anthropic-ai/claude-code
USER mongo

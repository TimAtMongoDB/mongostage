# Component fragment: Grok Build CLI
# Requires a node-capable base layer (FROM must include Node.js)
# Installed via xAI's official install script

USER root
RUN curl -fsSL https://x.ai/cli/install.sh | bash
USER mongo

# Component fragment: Claude Code CLI
# Works on any base layer — installs Node.js if npm is not already present

USER root
RUN if ! command -v npm > /dev/null 2>&1; then \
      mkdir -p /etc/apt/keyrings && \
      curl -fsSL --retry 3 https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
      echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list && \
      apt-get update && \
      apt-get install -y --no-install-recommends nodejs && \
      apt-get clean && rm -rf /var/lib/apt/lists/*; \
    fi && \
    npm install -g @anthropic-ai/claude-code
USER mongo

# Component fragment: Node.js 22 LTS + Git
# Multistage: NodeSource setup runs in a downloader stage; only the binary is copied

FROM ubuntu:24.04 AS node-downloader
ARG NODE_MAJOR=22
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
      gnupg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL --retry 3 https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Component fragment body - FROM resolved by build command
USER root
COPY --from=node-downloader /usr/bin/node /usr/bin/node
COPY --from=node-downloader /usr/bin/npm /usr/bin/npm
COPY --from=node-downloader /usr/lib/node_modules /usr/lib/node_modules
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
USER mongo

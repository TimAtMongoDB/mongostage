# Stage 1: download Starship binary in a disposable stage
FROM ubuntu:24.04 AS starship-downloader
ARG STARSHIP_VERSION=1.21.1
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* && \
    curl -fsSL --retry 3 \
      "https://github.com/starship/starship/releases/download/v${STARSHIP_VERSION}/starship-x86_64-unknown-linux-musl.tar.gz" \
      | tar xz -C /usr/local/bin starship && \
    chmod +x /usr/local/bin/starship

# Stage 2: the actual base image
FROM ubuntu:24.04

# Stable environment declarations first
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC
ENV TERM=xterm-256color
ENV LANG=en_US.UTF-8
ENV STARSHIP_CONFIG=/etc/mongodb/starship.toml

# System packages (stable - changes rarely)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      locales \
      ncurses-bin \
      bash \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* && \
    locale-gen en_US.UTF-8

# Copy Starship binary from downloader stage (no curl in final image)
COPY --from=starship-downloader /usr/local/bin/starship /usr/local/bin/starship

# Non-root user
RUN useradd -m -s /bin/bash mongo

# Working directory
RUN mkdir -p /home/mongo/demo && chown mongo:mongo /home/mongo/demo

# Silence all Linux startup noise
RUN rm -f /etc/motd && \
    rm -f /etc/update-motd.d/* && \
    echo "" > /etc/bash.bashrc

# MongoDB branding assets (volatile - changes on config edits)
RUN mkdir -p /etc/mongodb
COPY assets/leaf.txt /etc/mongodb/leaf.txt
COPY assets/starship.toml /etc/mongodb/starship.toml
COPY assets/bashrc /etc/mongodb/bashrc

# Apply bashrc to the mongo user
RUN cp /etc/mongodb/bashrc /home/mongo/.bashrc && \
    chown mongo:mongo /home/mongo/.bashrc

USER mongo
WORKDIR /home/mongo/demo

# Component fragment: MongoDB Community Server 8.0
# FROM resolved by build command - always stacks on shell (enforced by layering table)
# The MongoDB apt repo key is installed by shell.Dockerfile; this fragment reuses it

USER root
# MongoDB org repo already configured by shell.Dockerfile in the base layer
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      mongodb-org=8.0.* \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* && \
    mkdir -p /home/mongo/data && \
    chown mongo:mongo /home/mongo/data

COPY assets/server-start.sh /usr/local/bin/server-start.sh
RUN chmod +x /usr/local/bin/server-start.sh

USER mongo
CMD ["/usr/local/bin/server-start.sh"]

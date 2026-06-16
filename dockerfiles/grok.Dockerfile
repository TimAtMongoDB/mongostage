# Component fragment: Grok Build CLI
# Requires a node-capable base layer (FROM must include Node.js)
# FROM resolved by build command - only valid on node-* images

USER root
RUN npm install -g @xai-org/grok-build || npm install -g grok-build
USER mongo

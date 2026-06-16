# Component fragment: Grok Build CLI
# Requires a node-capable base layer (FROM must include Node.js)
# FROM resolved by build command - only valid on node-* images

USER root
RUN npm install -g @xai-org/grok-build 2>/dev/null || \
    npm install -g grok-build 2>/dev/null || \
    echo "Warning: Grok CLI package name not yet confirmed - verify package name before build"
USER mongo

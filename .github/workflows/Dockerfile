FROM node:20-alpine
ARG REPO_DIR
WORKDIR /app
RUN npm install -g @anthropic-ai/claude-code @modelcontextprotocol/sdk

# Add global node_modules to NODE_PATH
ENV NODE_PATH=/usr/local/lib/node_modules

RUN apk update
RUN apk add --no-cache bash
RUN apk add --no-cache git
RUN apk add --no-cache curl
RUN apk add --no-cache python3
RUN apk add --no-cache build-base
RUN apk add --no-cache git
RUN apk add --no-cache openssh-client
RUN apk add --no-cache less
RUN apk add --no-cache procps
RUN apk add --no-cache sudo
RUN apk add --no-cache fzf
RUN apk add --no-cache zsh
RUN apk add --no-cache man-db
RUN apk add --no-cache unzip
RUN apk add --no-cache iptables
RUN apk add --no-cache ipset
RUN apk add --no-cache iproute2
RUN apk add --no-cache jq
RUN apk add --no-cache ripgrep
RUN apk add --no-cache fd
RUN apk add --no-cache vim
RUN apk add --no-cache github-cli
RUN apk add --no-cache ripgrep
RUN apk add --no-cache curl
RUN apk add --no-cache wget
# Create a non-root user 'github' and grant sudo access
RUN deluser --remove-home node 2>/dev/null || true && \
    adduser -D -s /bin/zsh -u 1000 -g 1000 github && \
    echo "github ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

USER github
WORKDIR /home/github/app


RUN claude mcp add -t stdio agent-manager node .github/mcp-servers/agent-manager/index.js
VOLUME ${REPO_DIR}
CMD ["/bin/bash"]

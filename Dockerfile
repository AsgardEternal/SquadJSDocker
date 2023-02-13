# syntax=docker/dockerfile:1.4

# hadolint global ignore=DL3003,DL3008

FROM debian:bullseye-slim AS setup

ARG squadjs_version="3.7.0"

ENV USER="squadjs"
ENV USER_HOME="/home/${USER}"
ENV SQUADJS_DIR="${USER_HOME}/SquadJS/"

COPY --chown=root:root --chmod=0744 ./scripts/prepare-node14-yarn.bash /root/prepare-node14-yarn.bash
SHELL [ "/bin/bash", "-c" ]

RUN <<__EOR__
printf "Creating user\n"
useradd -m "${USER}"

printf "Installing Prereqs\n"
/root/prepare-node14-yarn.bash
apt-get update
    apt-get install -y --no-install-suggests --no-install-recommends \
    yarn \
    nodejs \
    git=1:2.30.2-1 \
    sqlite3=3.34.1-3

su "${USER}" - <<- __EOC__
    (
        git clone --depth 1 --branch "v${squadjs_version}" https://github.com/Team-Silver-Sphere/SquadJS.git "${USER_HOME}/SquadJS"
        cd "${USER_HOME}/SquadJS" || exit 1
        yarn install
        yarn cache clean
    )
__EOC__

apt-get remove git yarn
rm -rf /var/lib/apt/lists/* /root/prepare-node14-yarn.bash

__EOR__

FROM setup as prod

USER "${USER}"
WORKDIR "${USER_HOME}/SquadJS"
COPY ./scripts/entry.sh .
COPY ./squadjsPlugins/*.js "${USER_HOME}/SquadJS/squad-server/plugins/"
ENTRYPOINT ["/bin/sh", "entry.sh"]

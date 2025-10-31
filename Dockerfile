FROM node:20-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# ADD SSL Certificates here if needed. Example:
# RUN apk --no-check-certificate add openssl
# RUN wget https://{CERTIFICATE_PEM} -O /usr/local/share/ca-certificates/ca.pem
# RUN openssl x509 -in /usr/local/share/ca-certificates/ca.pem -out /usr/local/share/ca-certificates/ca.crt
# RUN update-ca-certificates

RUN corepack enable
USER node
RUN corepack prepare pnpm@latest-10 --activate

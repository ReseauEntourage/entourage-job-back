FROM node:16.17.1 as dev

WORKDIR /src
COPY package.json /
COPY yarn.lock /

EXPOSE 3002
ENV NODE_ENV=dev
RUN chown root.root .
RUN yarn install
COPY . /
CMD ["yarn", "run", "start:dev"]

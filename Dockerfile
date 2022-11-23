FROM node:16 as dev

WORKDIR /src
COPY package.json /
COPY yarn.lock /

EXPOSE 3002
ENV NODE_ENV=dev
RUN chown root.root .
RUN yarn
RUN rm -f -r node_modules/sharp
RUN npm install --platform=linux --arch=x64 sharp --legacy-peer-deps
COPY . /
CMD ["yarn", "run", "start:dev"]

FROM node:11

MAINTAINER yorikw

# Create app directory
RUN mkdir -p /opt/app
WORKDIR /opt/app

# Install app dependencies
COPY ./package.json /opt/app
RUN npm install

# Bundle app source
COPY . /opt/app

EXPOSE 443
EXPOSE 8080
CMD [ "npm", "start" ]

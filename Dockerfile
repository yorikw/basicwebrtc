FROM node:14

# Create app directory
RUN mkdir -p /usr/src/webrtc
WORKDIR /usr/src/webrtc

# Extract container
ADD ssl.tar.gz /usr/src/webrtc

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json /usr/src/webrtc
RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . /usr/src/webrtc

EXPOSE 4343
CMD [ "node", "server.js" ]
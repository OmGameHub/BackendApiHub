FROM node:lts-alpine

# Install necessary dependencies
RUN apk add --no-cache openssl bash

# Create app directory
WORKDIR /var/app

# Install app dependencies
COPY ./package*.json ./

RUN npm install

# Bundle app source
COPY . .

# Generate Prisma client
RUN npx prisma generate

CMD ["npm", "run", "dev"]
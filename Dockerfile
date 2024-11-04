FROM node:18

WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Copy the wait-for-it script into the container
COPY wait-for-it.sh /usr/local/bin/wait-for-it

# Expose the port the app runs on
EXPOSE 3000

# Command to run the app with wait-for-it
CMD ["wait-for-it", "db:3306", "--timeout=30", "--", "node", "server.js"]
FROM quay.io/lyfe00011/md:beta
WORKDIR /root/LyFE/
COPY . .
RUN yarn install
ENV AUTO_UPDATE=false
CMD ["npm", "start"]

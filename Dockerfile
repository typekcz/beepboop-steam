FROM dorowu/ubuntu-desktop-lxde-vnc

ENV USER=beepboop
ENV PASSWORD=beebpoop

# Chrome repository signature couldn't be verified - ignoring, don't care about it.
RUN rm -f /etc/apt/sources.list.d/google-chrome.list
RUN dpkg --add-architecture i386
RUN apt update
RUN apt install -y --no-install-recommends mesa-utils steam-installer curl
# Additional packages for pulseaudio: pulseaudio pulseaudio-utils pavucontrol

# Install non archaic NodeJS
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && apt install -y --no-install-recommends nodejs

# Uninstall unused packages and files
RUN apt remove -y nginx python3-pip python3-dev build-essential yarn && apt-get autoclean -y && apt-get autoremove -y
RUN rm -rf /usr/local/lib/web

ADD . /beepboop

RUN mkdir -p /home/$USER/.steam

# Setup virtual audio devices
RUN cat /beepboop/docker/pulseaudio.pa >> /etc/pulse/default.pa

# Append supervisord.conf
RUN cat /beepboop/docker/supervisor.conf > /etc/supervisor/conf.d/supervisord.conf

# Node app
RUN chmod -R 777 /beepboop
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN cd /beepboop && npm ci
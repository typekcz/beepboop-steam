FROM dorowu/ubuntu-desktop-lxde-vnc

ENV USER=beepboop
ENV PASSWORD=beebpoop

# Chrome repository signature couldn't be verified - ignoring, don't care about it.
RUN rm -f /etc/apt/sources.list.d/google-chrome.list
RUN dpkg --add-architecture i386
RUN apt update
RUN apt install -y --no-install-recommends mesa-utils steam-installer pulseaudio pulseaudio-utils pavucontrol curl

# Install non archaic NodeJS
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && apt install -y --no-install-recommends nodejs

# Steam launcher
ADD steam-launcher.sh /
ADD steam-launcher.desktop /home/$USER/.config/autostart/

RUN mkdir -p /home/$USER/.steam

# Setup virtual audio devices
ADD pulseaudio.pa /
RUN cat /pulseaudio.pa >> /etc/pulse/default.pa && rm -f /pulseaudio.pa

# Append supervisord.conf
ADD supervisor.conf /
RUN cat /supervisor.conf >> /etc/supervisor/conf.d/supervisord.conf && rm -f /supervisord.conf

# Node app
ADD node-app /node-app
RUN chmod -R 777 /node-app
RUN cd /node-app && npm install
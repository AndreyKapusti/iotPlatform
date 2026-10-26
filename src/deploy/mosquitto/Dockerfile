FROM eclipse-mosquitto:2

COPY mosquitto.conf /mosquitto/config/mosquitto.conf
COPY acl /mosquitto/config/acl
COPY docker-entrypoint.sh /signaldeck-entrypoint.sh
RUN chmod 755 /signaldeck-entrypoint.sh

ENTRYPOINT ["/signaldeck-entrypoint.sh"]
CMD ["/usr/sbin/mosquitto", "-c", "/mosquitto/config/mosquitto.conf"]

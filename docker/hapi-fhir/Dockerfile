FROM hapiproject/hapi:latest

# The image uses PropertiesLauncher with:
#   -Dloader.path=main.war!/WEB-INF/classes/,main.war!/WEB-INF/,/app/extra-classes
#
# /app/extra-classes is the official extension point for adding extra JARs.
# hapiproject/hapi:latest (v8.x) does not bundle the MySQL JDBC driver,
# so we place it here — no WAR repacking required.
COPY mysql-connector-j.jar /app/extra-classes/mysql-connector-j.jar

# /app/config/application.yaml is the official config override path.
COPY application.yaml /app/config/application.yaml

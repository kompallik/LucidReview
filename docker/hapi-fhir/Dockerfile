# Pin to HAPI FHIR 7.6.0 — the v8.x (latest) has breaking changes:
#   - HapiFhirMySQL8Dialect removed (ClassNotFoundException)
#   - Hibernate 6.6.x sequence extraction bug with MySQL
# v7.6.0 has the working dialect, matching local dev behavior.
FROM hapiproject/hapi:v7.6.0

# Neither v7.6.0 nor v8.x bundle the MySQL JDBC driver.
# /app/extra-classes is on the PropertiesLauncher loader.path.
COPY mysql-connector-j.jar /app/extra-classes/mysql-connector-j.jar

# /app/config/application.yaml is the official config override path.
COPY application.yaml /app/config/application.yaml

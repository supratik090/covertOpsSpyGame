# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Cache Maven local repository across builds (invalidated only when pom.xml changes)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Source & build (invalidated on code changes, but deps are cached)
COPY src ./src
RUN mvn clean package -DskipTests -B

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 7900
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]

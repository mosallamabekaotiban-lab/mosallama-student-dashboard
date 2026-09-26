FROM eclipse-temurin:21-jdk
WORKDIR /app
COPY . .
RUN javac StudentDashboardServer.java
EXPOSE 8080
CMD ["java", "StudentDashboardServer"]

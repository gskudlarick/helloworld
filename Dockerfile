FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY HelloWorld.java .
RUN javac HelloWorld.java

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/HelloWorld.class .
COPY --from=build /app/HelloWorld\$Greeting.class .
CMD ["java", "HelloWorld"]

/**
 * Hello World - modernized for Java 21.
 * Run with: java HelloWorld.java
 */
public class HelloWorld {

    record Greeting(int id, String language, String message) {}

    public static void main(String[] args) {
        var greetings = java.util.List.of(
                new Greeting(1, "English", "Hello, World!"),
                new Greeting(2, "Spanish", "Hola, Mundo!"),
                new Greeting(3, "French", "Bonjour, le Monde!"),
                new Greeting(4, "German", "Hallo, Welt!"),
                new Greeting(5, "Italian", "Ciao, Mondo!")
        );

        greetings.forEach(g ->
                System.out.printf("%d. [%s] %s%n", g.id(), g.language(), g.message()));

        System.out.println("\nTotal greetings: " + greetings.size());
    }
}

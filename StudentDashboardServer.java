import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class StudentDashboardServer {
    private static final int PORT = 8080;
    private static final Path DATA_FILE = Paths.get("grades.data");
    private static final List<Grade> grades = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        loadGrades();

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/api/grades", StudentDashboardServer::handleGrades);
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();

        System.out.println("Student Dashboard API running at http://localhost:" + PORT);
        System.out.println("Press Ctrl+C to stop the server.");
    }

    private static void handleGrades(HttpExchange exchange) throws IOException {
        addCorsHeaders(exchange);

        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();
        String id = path.replace("/api/grades", "").replace("/", "");

        try {
            if ("OPTIONS".equalsIgnoreCase(method)) {
                send(exchange, 204, "");
            } else if ("GET".equalsIgnoreCase(method) && id.isEmpty()) {
                send(exchange, 200, gradesToJson());
            } else if ("POST".equalsIgnoreCase(method) && id.isEmpty()) {
                Grade grade = gradeFromJson(readBody(exchange));
                synchronized (grades) {
                    grades.add(grade);
                    saveGrades();
                }
                send(exchange, 201, grade.toJson());
            } else if ("PUT".equalsIgnoreCase(method) && !id.isEmpty()) {
                Grade updated = gradeFromJson(readBody(exchange));
                synchronized (grades) {
                    for (int i = 0; i < grades.size(); i++) {
                        if (grades.get(i).id.equals(id)) {
                            updated.id = id;
                            grades.set(i, updated);
                            saveGrades();
                            send(exchange, 200, updated.toJson());
                            return;
                        }
                    }
                }
                send(exchange, 404, "{\"error\":\"Grade not found\"}");
            } else if ("DELETE".equalsIgnoreCase(method) && !id.isEmpty()) {
                synchronized (grades) {
                    boolean removed = grades.removeIf(grade -> grade.id.equals(id));
                    saveGrades();
                    send(exchange, removed ? 200 : 404, removed ? "{\"message\":\"Deleted\"}" : "{\"error\":\"Grade not found\"}");
                }
            } else {
                send(exchange, 405, "{\"error\":\"Method not allowed\"}");
            }
        } catch (Exception error) {
            error.printStackTrace();
            send(exchange, 500, "{\"error\":\"" + escape(error.getMessage()) + "\"}");
        }
    }

    private static Grade gradeFromJson(String json) {
        String id = getJsonValue(json, "id");
        String code = getJsonValue(json, "code");
        String name = getJsonValue(json, "name");
        String grade = getJsonValue(json, "grade");
        String status = getJsonValue(json, "status");

        if (id == null || id.isBlank()) id = UUID.randomUUID().toString();
        if (code == null || code.isBlank() || name == null || name.isBlank() || grade == null || status == null) {
            throw new IllegalArgumentException("Missing required fields");
        }

        double numericGrade = Double.parseDouble(grade);
        if (numericGrade < 0 || numericGrade > 100) throw new IllegalArgumentException("Grade must be 0 to 100");

        return new Grade(id, code, name, numericGrade, status);
    }

    private static String getJsonValue(String json, String key) {
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(?:\"([^\"]*)\"|([-+]?[0-9]*\\.?[0-9]+))");
        Matcher matcher = pattern.matcher(json);
        if (!matcher.find()) return null;
        return matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
    }

    private static String gradesToJson() {
        StringBuilder result = new StringBuilder("[");
        for (int i = 0; i < grades.size(); i++) {
            if (i > 0) result.append(",");
            result.append(grades.get(i).toJson());
        }
        return result.append("]").toString();
    }

    private static void loadGrades() {
        if (!Files.exists(DATA_FILE)) return;
        try {
            for (String line : Files.readAllLines(DATA_FILE)) {
                String[] parts = line.split("\\|", -1);
                if (parts.length == 5) {
                    grades.add(new Grade(parts[0], parts[1], parts[2], Double.parseDouble(parts[3]), parts[4]));
                }
            }
        } catch (Exception error) {
            System.out.println("Could not load saved grades: " + error.getMessage());
        }
    }

    private static void saveGrades() throws IOException {
        List<String> lines = new ArrayList<>();
        for (Grade grade : grades) {
            lines.add(String.join("|", clean(grade.id), clean(grade.code), clean(grade.name),
                    String.valueOf(grade.grade), clean(grade.status)));
        }
        Files.write(DATA_FILE, lines, StandardCharsets.UTF_8);
    }

    private static String clean(String value) {
        return value.replace("|", "/").replace("\n", " ");
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        return new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    }

    private static void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
    }

    private static void send(HttpExchange exchange, int status, String response) throws IOException {
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }

    private static String escape(String value) {
        if (value == null) return "Unknown error";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    static class Grade {
        String id, code, name, status;
        double grade;

        Grade(String id, String code, String name, double grade, String status) {
            this.id = id;
            this.code = code;
            this.name = name;
            this.grade = grade;
            this.status = status;
        }

        String toJson() {
            return "{\"id\":\"" + escape(id) + "\",\"code\":\"" + escape(code) +
                    "\",\"name\":\"" + escape(name) + "\",\"grade\":" + grade +
                    ",\"status\":\"" + escape(status) + "\"}";
        }
    }
}

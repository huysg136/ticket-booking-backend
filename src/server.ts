import "dotenv/config";
import app from "./app";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "server_started",
      port: Number(PORT),
      docs: `http://localhost:${PORT}/api/docs`,
    }),
  );
});

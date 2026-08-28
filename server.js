/* =========================
   SPA FALLBACK
========================= */

app.use((req, res, next) => {

  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(
    path.join(__dirname, "index.html")
  );

});

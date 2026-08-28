/* =========================
   SPA FALLBACK
========================= */

app.get(
  "/*splat",
  (req, res, next) => {

    if (
      req.path.startsWith("/api/")
    ) {
      return next();
    }

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );

  }
);

/* =========================
   START SERVER
========================= */

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `🚀 Apex Agro server running on port ${PORT}`
    );

    console.log(
      `🌱 Users: ${db.users.length}`
    );

    console.log(
      `📦 Ads: ${db.ads.length}`
    );

  }
);

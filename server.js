const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 10000;

app.use(express.json());

// 1. Бардык статикалык файлдарды (html, css, js) ачууга уруксат берүү
app.use(express.static(__dirname));

// 2. Башкы дарекке киргенде index.html файлын берүү
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер ${PORT} портунда иштеп баштады`);
});


  

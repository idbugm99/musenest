{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const http = require('http');\
\
const server = http.createServer((req, res) => \{\
  res.writeHead(200, \{ 'Content-Type': 'text/html' \});\
  res.end('<h1>MuseNest staging is alive!</h1>');\
\});\
\
const PORT = process.env.PORT || 3000;\
server.listen(PORT, () => \{\
  console.log(`Server running on port $\{PORT\}`);\
\});\
}
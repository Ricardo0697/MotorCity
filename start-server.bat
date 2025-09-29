@echo off
REM Inicia un servidor web local en el puerto 8080 usando Python
python -m http.server 8080
REM Abre el navegador automáticamente
start http://localhost:8080/public/index.html

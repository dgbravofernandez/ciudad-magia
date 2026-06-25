@echo off
REM Lanzador del autoloop de scraping 24/7.
REM refill_autoloop.py encadena en bucle continuo: refill PNFG -> import a Supabase
REM -> enriquecimiento web -> repite (pausa corta entre ciclos, sin dormir hasta las 4am).
REM Para en cuanto haya 4 ciclos seguidos sin emails nuevos.
REM
REM Quitar la tarea:  schtasks /delete /tn "CluberlyAutoloop" /f
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
cd /d "C:\Users\dgbra\Ciudad Magia\docs\marketing"
echo ---- autoloop arranque %DATE% %TIME% ---- >> refill_autoloop.log
python -u refill_autoloop.py >> refill_autoloop.log 2>&1

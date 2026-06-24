@echo off
REM ============================================================================
REM Programa el scraper de leads 2x/dia (04:00 y 14:00).
REM Cada ejecucion de refill_patient.py hace round-robin sobre todas las
REM federaciones (hasta 3.5h), escribe al Excel e importa a Supabase solo.
REM Dos pases/dia con horas separadas dan tiempo a cada dominio a enfriarse.
REM No requiere admin — corre con permisos del usuario actual.
REM
REM Quitar las tareas:  schtasks /delete /tn "CluberlyScrape-AM" /f
REM                     schtasks /delete /tn "CluberlyScrape-PM" /f
REM ============================================================================

set RUNNER="C:\Users\dgbra\Ciudad Magia\docs\marketing\start_scraper.bat"

schtasks /create /tn "CluberlyScrape-AM" /tr %RUNNER% /sc DAILY /st 04:00 /f
schtasks /create /tn "CluberlyScrape-PM" /tr %RUNNER% /sc DAILY /st 14:00 /f

echo.
echo Tareas creadas. Verificando:
schtasks /query /tn "CluberlyScrape-AM"
schtasks /query /tn "CluberlyScrape-PM"

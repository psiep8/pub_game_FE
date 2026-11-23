@echo off
rem Backend di gioco sulla porta 8090, con la configurazione del .env della
rem radice (stessa fonte di npm run dev). Il processo gira senza console, così
rem chiudere un terminale non lo ferma.
rem
rem   start-8090.cmd            avvia (task Windows "PubGame-BE-8090")
rem   start-8090.cmd stop       ferma il server sulla 8090
rem   start-8090.cmd restart    ferma, attende la porta libera, riavvia
rem   start-8090.cmd status     dice se il server risponde e chi occupa la porta
rem   start-8090.cmd run        avvio in primo piano: lo usa il task
setlocal EnableExtensions
cd /d "%~dp0"
set "TASK=PubGame-BE-8090"
set "PORT=8090"

if /i "%~1"=="stop" goto :stop
if /i "%~1"=="restart" goto :restart
if /i "%~1"=="status" goto :status
if /i "%~1"=="run" goto :run
if /i "%~1"=="start" goto :start
if "%~1"=="" goto :start
echo Uso: start-8090.cmd [start^|stop^|restart^|status]
exit /b 2

:run
if not exist "..\..\.env" (
  echo .env non trovato in %~dp0..\..\ >&2
  exit /b 1
)
if not exist "target" mkdir target

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("..\..\.env") do (
  if not "%%~A"=="" set "%%~A=%%~B"
)

rem javaw: nessuna console agganciata, quindi la chiusura di un terminale
rem (o di una sessione dell'editor) non manda CTRL_CLOSE al server.
"..\..\.tools\jdk-25.0.5+8\bin\javaw.exe" -jar target\pub_game_BE-2.3.2.jar --server.port=%PORT% >> "target\backend-8090.log" 2>&1
exit /b %ERRORLEVEL%

:start
call :findpid
if defined PID (
  echo Backend gia attivo sulla %PORT% ^(PID %PID%^). Usa "restart" per riavviarlo.
  exit /b 0
)
schtasks /run /tn "%TASK%" >nul 2>&1
if errorlevel 1 (
  echo Task "%TASK%" non trovato: avvio diretto.in primo piano.
  call "%~f0" run
  exit /b %ERRORLEVEL%
)
echo Avvio richiesto al task "%TASK%". Il backend impiega da 1 a 3 minuti: usa "status" per sapere quando risponde.
exit /b 0

:stop
call :findpid
if not defined PID (
  echo Nessun processo in ascolto sulla %PORT%.
  exit /b 0
)
echo Fermo il backend sulla %PORT% ^(PID %PID%^)...
taskkill /F /PID %PID% >nul 2>&1
call :waitfree
if errorlevel 1 exit /b 1
echo Backend fermato.
exit /b 0

:restart
call :stop
if errorlevel 1 (
  echo Riavvio annullato: la porta %PORT% non si e liberata.
  exit /b 1
)
call :findpid
if defined PID (
  echo Riavvio annullato: la porta %PORT% e ancora occupata da %PID%.
  exit /b 1
)
schtasks /run /tn "%TASK%" >nul 2>&1
if errorlevel 1 (
  echo Task "%TASK%" non trovato: avvio diretto in primo piano.
  call "%~f0" run
  exit /b %ERRORLEVEL%
)
echo Riavvio richiesto, attendo che il backend risponda...
call :waitready
if errorlevel 1 (
  echo Riavvio incompleto: il log e in target\backend-8090.log
  exit /b 1
)
echo Backend riavviato e attivo su http://127.0.0.1:%PORT%.
exit /b 0

:status
call :findpid
if defined PID (
  echo Porta %PORT%: in ascolto, PID %PID%
) else (
  echo Porta %PORT%: libera
)
for /f %%C in ('curl -s -o nul -w "%%{http_code}" --max-time 3 http://127.0.0.1:%PORT%/games/active 2^>nul') do set "CODE=%%C"
if "%CODE%"=="200" (
  echo HTTP: risponde ^(200^)
) else (
  echo HTTP: non risponde
)
schtasks /query /tn "%TASK%" /fo list 2>nul | findstr /R /C:"Stato:" /C:"Status:" /C:"Prossima esecuzione:" /C:"Next Run Time:"
exit /b 0

:findpid
set "PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:"LISTENING" ^| findstr /C:":%PORT% "') do set "PID=%%P"
exit /b 0

:waitfree
set /a tries=0
:waitfree_loop
call :findpid
if not defined PID exit /b 0
set /a tries+=1
if %tries% GEQ 20 (
  echo Attenzione: la porta %PORT% risulta ancora occupata da %PID%.
  exit /b 1
)
ping -n 2 127.0.0.1 >nul
goto :waitfree_loop

:waitready
set /a tries=0
:waitready_loop
set "CODE="
for /f %%C in ('curl -s -o nul -w "%%{http_code}" --max-time 2 http://127.0.0.1:%PORT%/games/active 2^>nul') do set "CODE=%%C"
if "%CODE%"=="200" exit /b 0
set /a tries+=1
if %tries% GEQ 150 exit /b 1
ping -n 3 127.0.0.1 >nul
goto :waitready_loop

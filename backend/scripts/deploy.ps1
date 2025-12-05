# Account Management System Deploy Script (Windows)
# Usage: .\deploy.ps1 [start|stop|restart|status|logs]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("start", "stop", "restart", "status", "logs")]
    [string]$Action
)

$APP_NAME = "AccountManager"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = Split-Path -Parent $SCRIPT_DIR
$PID_FILE = Join-Path $PROJECT_DIR "app.pid"
$LOG_FILE = Join-Path $PROJECT_DIR "app.log"
$ERROR_LOG_FILE = Join-Path $PROJECT_DIR "error.log"
$MAIN_FILE = Join-Path $PROJECT_DIR "main.py"

function Print-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Print-Warning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Check-Status {
    if (Test-Path $PID_FILE) {
        $ProcessId = Get-Content $PID_FILE
        $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if ($process) {
            return @{ Status = "running"; ProcessId = $ProcessId; Process = $process }
        } else {
            return @{ Status = "dead"; ProcessId = $ProcessId }
        }
    } else {
        return @{ Status = "stopped" }
    }
}


function Start-AppService {
    $status = Check-Status
    
    if ($status.Status -eq "running") {
        Print-Warning "$APP_NAME is already running (PID: $($status.ProcessId))"
        return
    }
    
    Print-Info "Starting $APP_NAME..."
    
    Set-Location $PROJECT_DIR
    
    # Start Python process in background
    $process = Start-Process -FilePath "python" -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port 8999" -WorkingDirectory $PROJECT_DIR -PassThru -WindowStyle Hidden -RedirectStandardOutput $LOG_FILE -RedirectStandardError $ERROR_LOG_FILE
    
    Start-Sleep -Seconds 2
    
    if ($process -and !$process.HasExited) {
        $process.Id | Out-File -FilePath $PID_FILE -Encoding UTF8
        Print-Info "$APP_NAME started successfully!"
        Print-Info "PID: $($process.Id)"
        Print-Info "Log file: $LOG_FILE"
        Print-Info "URL: http://localhost:8999"
    } else {
        Print-Error "$APP_NAME failed to start. Check error log: $ERROR_LOG_FILE"
        if (Test-Path $PID_FILE) {
            Remove-Item $PID_FILE
        }
    }
}

function Stop-AppService {
    $status = Check-Status
    
    if ($status.Status -eq "stopped") {
        Print-Warning "$APP_NAME is not running"
        return
    }
    
    if ($status.Status -eq "dead") {
        Print-Warning "PID file exists but process is dead, cleaning up"
        Remove-Item $PID_FILE
        return
    }
    
    Print-Info "Stopping $APP_NAME (PID: $($status.ProcessId))..."
    
    try {
        Stop-Process -Id $status.ProcessId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
        
        $process = Get-Process -Id $status.ProcessId -ErrorAction SilentlyContinue
        if (-not $process) {
            Print-Info "$APP_NAME stopped"
            Remove-Item $PID_FILE -ErrorAction SilentlyContinue
        } else {
            Print-Warning "Process may not have stopped completely"
        }
    } catch {
        Print-Error "Error stopping service: $_"
    }
}


function Restart-AppService {
    Print-Info "Restarting $APP_NAME..."
    Stop-AppService
    Start-Sleep -Seconds 2
    Start-AppService
}

function Show-Status {
    $status = Check-Status
    
    Write-Host "========================================"
    Write-Host "  $APP_NAME Status"
    Write-Host "========================================"
    
    switch ($status.Status) {
        "running" {
            Print-Info "Status: Running"
            Write-Host "PID: $($status.ProcessId)"
            $process = $status.Process
            Write-Host "Memory: $([math]::Round($process.WorkingSet64 / 1MB, 2)) MB"
            Write-Host "CPU: $($process.CPU) seconds"
            Write-Host "Started: $($process.StartTime)"
            Write-Host "Log: $LOG_FILE"
        }
        "dead" {
            Print-Warning "Status: Dead (PID file exists but process not found)"
        }
        "stopped" {
            Print-Error "Status: Stopped"
        }
    }
    
    Write-Host "========================================"
}

function Show-Logs {
    if (-not (Test-Path $LOG_FILE)) {
        Print-Error "Log file not found: $LOG_FILE"
        return
    }
    
    Print-Info "Viewing logs (Ctrl+C to exit)..."
    Write-Host "========================================"
    Get-Content $LOG_FILE -Wait -Tail 50
}

function Main {
    if (-not $Action) {
        Write-Host "Usage: .\deploy.ps1 [start|stop|restart|status|logs]"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  start   - Start service"
        Write-Host "  stop    - Stop service"
        Write-Host "  restart - Restart service"
        Write-Host "  status  - Show service status"
        Write-Host "  logs    - View logs"
        exit 1
    }
    
    switch ($Action) {
        "start" { Start-AppService }
        "stop" { Stop-AppService }
        "restart" { Restart-AppService }
        "status" { Show-Status }
        "logs" { Show-Logs }
    }
}

Main

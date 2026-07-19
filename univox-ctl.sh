#!/bin/bash
# ============================================
# Unyvox - Service Manager
# ============================================
# Gestisci i servizi Unyvox con systemd
# ============================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SERVICES="univox-server univox-redirect univox-tunnel univox-watcher"

show_help() {
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   🚀 Unyvox - Service Manager            ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Uso: $0 <comando>"
    echo ""
    echo -e "${YELLOW}Comandi:${NC}"
    echo -e "  ${GREEN}start${NC}      Avvia tutti i servizi"
    echo -e "  ${GREEN}stop${NC}       Ferma tutti i servizi"
    echo -e "  ${GREEN}restart${NC}    Riavvia tutti i servizi"
    echo -e "  ${GREEN}status${NC}     Mostra lo stato dei servizi"
    echo -e "  ${GREEN}logs${NC}       Mostra i log in tempo reale"
    echo -e "  ${GREEN}enable${NC}     Abilita avvio automatico al boot"
    echo -e "  ${GREEN}disable${NC}    Disabilita avvio automatico"
    echo -e "  ${GREEN}help${NC}       Mostra questo messaggio"
    echo ""
}

start_services() {
    echo -e "${YELLOW}▶ Avvio dei servizi Unyvox...${NC}"
    for svc in $SERVICES; do
        systemctl --user start ${svc}.service 2>/dev/null
        if systemctl --user is-active --quiet ${svc}.service; then
            echo -e "  ${GREEN}✓${NC} ${svc} avviato"
        else
            echo -e "  ${RED}✗${NC} ${svc} non avviato"
        fi
    done
    echo ""
    echo -e "${GREEN}✅ Servizi avviati!${NC}"
}

stop_services() {
    echo -e "${YELLOW}▶ Ferma dei servizi Unyvox...${NC}"
    for svc in $SERVICES; do
        systemctl --user stop ${svc}.service 2>/dev/null
        echo -e "  ${GREEN}✓${NC} ${svc} fermato"
    done
    echo ""
    echo -e "${GREEN}✅ Servizi fermati!${NC}"
}

restart_services() {
    echo -e "${YELLOW}▶ Riavvio dei servizi Unyvox...${NC}"
    for svc in $SERVICES; do
        systemctl --user restart ${svc}.service 2>/dev/null
        if systemctl --user is-active --quiet ${svc}.service; then
            echo -e "  ${GREEN}✓${NC} ${svc} riavviato"
        else
            echo -e "  ${RED}✗${NC} ${svc} non avviato"
        fi
    done
    echo ""
    echo -e "${GREEN}✅ Servizi riavviati!${NC}"
}

show_status() {
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   📊 Stato Servizi Unyvox                ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""
    for svc in $SERVICES; do
        if systemctl --user is-active --quiet ${svc}.service; then
            echo -e "  ${GREEN}●${NC} ${svc}: ${GREEN}attivo${NC}"
        else
            echo -e "  ${RED}●${NC} ${svc}: ${RED}inattivo${NC}"
        fi
    done
    echo ""
    
    # Check if linger is enabled
    if loginctl show-user prizesmp 2>/dev/null | grep -q "Linger=yes"; then
        echo -e "  ${GREEN}✓${NC} Linger abilitato (avvio al boot attivo)"
    else
        echo -e "  ${RED}✗${NC} Linger non abilitato (servizi non partono al boot)"
        echo -e "    Esegui: ${YELLOW}loginctl enable-linger prizesmp${NC}"
    fi
    echo ""
}

show_logs() {
    echo -e "${YELLOW}▶ Log Unyvox (Ctrl+C per uscire)...${NC}"
    echo ""
    journalctl --user -u univox-server.service -u univox-redirect.service -u univox-tunnel.service -u univox-watcher.service -f
}

enable_autostart() {
    echo -e "${YELLOW}▶ Abilita avvio automatico...${NC}"
    for svc in $SERVICES; do
        systemctl --user enable ${svc}.service 2>/dev/null
        echo -e "  ${GREEN}✓${NC} ${svc} abilitato"
    done
    loginctl enable-linger prizesmp 2>/dev/null
    echo -e "  ${GREEN}✓${NC} Linger abilitato"
    echo ""
    echo -e "${GREEN}✅ Avvio automatico abilitato!${NC}"
    echo -e "${YELLOW}   I servizi partiranno al prossimo riavvio del computer.${NC}"
}

disable_autostart() {
    echo -e "${YELLOW}▶ Disabilita avvio automatico...${NC}"
    for svc in $SERVICES; do
        systemctl --user disable ${svc}.service 2>/dev/null
        echo -e "  ${GREEN}✓${NC} ${svc} disabilitato"
    done
    echo ""
    echo -e "${GREEN}✅ Avvio automatico disabilitato!${NC}"
}

# Main
case "$1" in
    start)      start_services ;;
    stop)       stop_services ;;
    restart)    restart_services ;;
    status)     show_status ;;
    logs)       show_logs ;;
    enable)     enable_autostart ;;
    disable)    disable_autostart ;;
    help|--help|-h) show_help ;;
    *)
        show_help
        exit 1
        ;;
esac

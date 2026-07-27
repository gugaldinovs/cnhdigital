// Desativado: fazia chamada direta à QueryBuscas com token exposto no client-side,
// gastando crédito da API a cada CPF digitado sem nenhum consumidor real (o evento
// 'cpfFound' disparado aqui nunca era escutado pelo bundle React). A busca de CPF
// real acontece via /api/consulta.php (backend), que agora tem fallback entre provedores.

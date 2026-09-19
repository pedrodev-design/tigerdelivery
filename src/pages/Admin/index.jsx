import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faBell,
  faBicycle,
  faCar,
  faCheck,
  faChevronRight,
  faCircleCheck,
  faIdCard,
  faLocationDot,
  faMotorcycle,
  faPhone,
  faRotate,
  faShieldHalved,
  faStore,
  faBowlFood,
  faUser,
  faUserClock,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { AnimatePresence, motion } from "motion/react";
import { useAccount } from "../../hooks/useAccount";
import { LoadingOverlay } from "../../components/ui/LoadingOverlay";
import { supabase } from "../../lib/supabase";
import { formatCpf, formatPhone } from "../../utils/validators";
import {
  deliverAdminNotification,
  playNotificationSound,
  requestNotificationPermission,
  showSystemNotification,
} from "../../services/notifications";
import styles from "./Admin.module.css";

const Icon = ({ icon }) => (
  <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" />
);
const filters = [
  { id: "all", label: "Todos" },
  { id: "pending", label: "Em análise" },
  { id: "approved", label: "Aprovados" },
  { id: "rejected", label: "Recusados" },
];
const statusLabel = {
  pending: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado",
  suspended: "Suspenso",
};
const vehicleInfo = {
  motorcycle: { label: "Moto", icon: faMotorcycle },
  bicycle: { label: "Bicicleta", icon: faBicycle },
  car: { label: "Carro", icon: faCar },
};
const date = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

function AccessState({ account }) {
  const loading = account.loading;
  if (loading)
    return (
      <LoadingOverlay
        label="Quase lá"
        detail="Conferindo as permissões da sua conta."
      />
    );
  return (
    <main className={styles.accessPage}>
      <div className={styles.accessCard}>
        <span>
          <Icon icon={loading ? faRotate : faShieldHalved} />
        </span>
        <h1>
          {loading
            ? "Abrindo painel"
            : account.user
              ? "Acesso reservado"
              : "Entre para continuar"}
        </h1>
        <p>
          {loading
            ? "Conferindo as permissões da sua conta."
            : account.user
              ? "Somente administradores TigreFood podem revisar cadastros de entregadores."
              : "Use uma conta autorizada para acessar o painel administrativo."}
        </p>
        {!loading && (
          <a href={account.user ? "#catalogo" : "#entrar"}>
            {account.user ? "Voltar ao TigreFood" : "Entrar na conta"}
            <Icon icon={faChevronRight} />
          </a>
        )}
      </div>
    </main>
  );
}

function ReviewPanel({
  application,
  onClose,
  onReview,
  onIdentityReview,
  saving,
}) {
  const [notes, setNotes] = useState(application.review_notes || "");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [selfieState, setSelfieState] = useState(
    application.identity?.selfie_path ? "loading" : "empty",
  );
  const profile = application.profiles || {};
  const vehicle =
    vehicleInfo[application.vehicle_type] || vehicleInfo.motorcycle;
  useEffect(() => {
    let active = true;
    const path = application.identity?.selfie_path;
    if (!path) return undefined;
    supabase.storage
      .from("driver-selfies")
      .createSignedUrl(path, 300)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data?.signedUrl) {
          setSelfieState("error");
          return;
        }
        setSelfieUrl(data.signedUrl);
        setSelfieState("ready");
      });
    return () => {
      active = false;
    };
  }, [application.identity?.selfie_path]);
  return (
    <motion.div
      className={styles.reviewOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.aside
        className={styles.reviewPanel}
        initial={{ x: 30, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.22 }}
      >
        <header>
          <div>
            <small>Análise de cadastro</small>
            <h2>{profile.full_name || "Novo entregador"}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar">
            <Icon icon={faXmark} />
          </button>
        </header>
        <div className={styles.identity}>
          <span>
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              <Icon icon={faUser} />
            )}
          </span>
          <div>
            <strong>{profile.full_name || "Nome não informado"}</strong>
            <small>Enviado em {date(application.submitted_at)}</small>
          </div>
          <b data-status={application.status}>
            {statusLabel[application.status]}
          </b>
        </div>
        <section className={styles.reviewData}>
          <h3>Dados para conferência</h3>
          <dl>
            <div>
              <dt>
                <Icon icon={faIdCard} />
                CPF
              </dt>
              <dd>{formatCpf(profile.cpf || "") || "Não informado"}</dd>
            </div>
            <div>
              <dt>
                <Icon icon={faPhone} />
                Celular
              </dt>
              <dd>{formatPhone(application.phone)}</dd>
            </div>
            <div>
              <dt>
                <Icon icon={faLocationDot} />
                Cidade
              </dt>
              <dd>{application.city}</dd>
            </div>
            <div>
              <dt>
                <Icon icon={vehicle.icon} />
                Veículo
              </dt>
              <dd>
                {vehicle.label}
                {application.vehicle_plate
                  ? ` · ${application.vehicle_plate}`
                  : ""}
              </dd>
            </div>
          </dl>
          <div className={styles.identityReview}>
            <span>
              <Icon icon={faShieldHalved} />
            </span>
            <div>
              <strong>Verificação de identidade</strong>
              <small>
                {application.identity?.status === "verified"
                  ? "Documento e selfie conferidos"
                  : application.identity?.status === "pending"
                    ? "Aguardando conferência automática"
                    : application.identity?.status === "unverified"
                      ? "Não conferida — solicite nova captura"
                      : "Ainda não iniciada"}
              </small>
            </div>
            <b data-status={application.identity?.status || "not_started"}>
              {application.identity?.status === "verified"
                ? "Conferida"
                : application.identity?.status === "pending"
                  ? "Em análise"
                  : "Pendente"}
            </b>
          </div>
          {application.identity?.selfie_path && (
            <div className={styles.selfieReview}>
              <div className={styles.selfieFrame}>
                {selfieState === "ready" && (
                  <img src={selfieUrl} alt="Selfie enviada para conferência" />
                )}
                {selfieState === "loading" && (
                  <span className={styles.selfieLoading}>
                    <Icon icon={faRotate} />
                  </span>
                )}
                {selfieState === "error" && (
                  <span className={styles.selfieEmpty}>
                    Não foi possível carregar a selfie.
                  </span>
                )}
              </div>
              <div className={styles.identityActions}>
                {application.identity.status === "pending" && (
                  <>
                    <button
                      type="button"
                      className={styles.identityApprove}
                      disabled={saving}
                      onClick={() => onIdentityReview("verified")}
                    >
                      Confirmar rosto
                    </button>
                    <button
                      type="button"
                      className={styles.identityReject}
                      disabled={saving}
                      onClick={() => onIdentityReview("unverified")}
                    >
                      Pedir nova captura
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
        <label className={styles.notes}>
          <span>Observação para o candidato</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, 500))}
            placeholder="Explique somente se precisar pedir uma correção."
          />
          <small>{notes.length}/500</small>
        </label>
        <footer>
          <button
            className={styles.reject}
            disabled={saving}
            onClick={() => onReview("rejected", notes)}
          >
            <Icon icon={faXmark} />
            Pedir correção
          </button>
          <button
            className={styles.approve}
            disabled={saving}
            onClick={() => onReview("approved", notes)}
          >
            {saving ? <i /> : <Icon icon={faCheck} />}Aprovar motorista
          </button>
        </footer>
      </motion.aside>
    </motion.div>
  );
}

function StoreReviewPanel({ store, onClose, onReview, saving }) {
  const [notes, setNotes] = useState(store.review_notes || "");
  return (
    <motion.div
      className={styles.reviewOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.aside
        className={styles.reviewPanel}
        initial={{ x: 30, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.22 }}
      >
        <header>
          <div>
            <small>Análise de loja</small>
            <h2>{store.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar">
            <Icon icon={faXmark} />
          </button>
        </header>
        <div className={styles.identity}>
          <span>
            <Icon icon={faStore} />
          </span>
          <div>
            <strong>{store.category}</strong>
            <small>Enviada em {date(store.created_at)}</small>
          </div>
          <b data-status={store.status}>
            {store.status === "pending"
              ? "Em análise"
              : store.status === "approved"
                ? "Aprovada"
                : "Recusada"}
          </b>
        </div>
        <section className={styles.reviewData}>
          <h3>Dados comerciais</h3>
          <dl>
            <div>
              <dt>
                <Icon icon={faIdCard} />
                CNPJ
              </dt>
              <dd>{store.cnpj}</dd>
            </div>
            <div>
              <dt>
                <Icon icon={faPhone} />
                Telefone
              </dt>
              <dd>{formatPhone(store.phone)}</dd>
            </div>
            <div>
              <dt>
                <Icon icon={faLocationDot} />
                Localização
              </dt>
              <dd>
                {store.city}
                {store.address ? ` · ${store.address}` : ""}
              </dd>
            </div>
            <div>
              <dt>
                <Icon icon={faBowlFood} />
                Descrição
              </dt>
              <dd>{store.description || "Não informada"}</dd>
            </div>
          </dl>
        </section>
        <label className={styles.notes}>
          <span>Observação para o lojista</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, 500))}
            placeholder="Explique somente se precisar pedir uma correção."
          />
          <small>{notes.length}/500</small>
        </label>
        <footer>
          <button
            className={styles.reject}
            disabled={saving}
            onClick={() => onReview("rejected", notes)}
          >
            <Icon icon={faXmark} />
            Pedir correção
          </button>
          <button
            className={styles.approve}
            disabled={saving}
            onClick={() => onReview("approved", notes)}
          >
            {saving ? <i /> : <Icon icon={faCheck} />}Aprovar loja
          </button>
        </footer>
      </motion.aside>
    </motion.div>
  );
}

function StoreQueue({
  stores,
  loading,
  filter,
  setFilter,
  counts,
  notice,
  onRefresh,
  onSelect,
}) {
  const visible = stores.filter(
    (item) =>
      filter === "all" ||
      (filter === "rejected"
        ? ["rejected", "suspended"].includes(item.status)
        : item.status === filter),
  );
  return (
    <section className={styles.queue}>
      <header>
        <div>
          <h2>Fila de lojas</h2>
          <p>Confira os dados antes de liberar uma operação no catálogo.</p>
        </div>
        <button onClick={onRefresh} aria-label="Atualizar">
          <Icon icon={faRotate} />
          Atualizar
        </button>
      </header>
      <div className={styles.filters}>
        {filters.map((item) => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            className={filter === item.id ? styles.filterActive : ""}
          >
            {item.label}
            <span>{counts[item.id]}</span>
          </button>
        ))}
      </div>
      {notice && <p className={styles.notice}>{notice}</p>}
      {loading ? (
        <div className={styles.skeleton}>
          <i />
          <i />
          <i />
        </div>
      ) : visible.length ? (
        <div className={styles.applicationList}>
          {visible.map((store) => (
            <button key={store.id} onClick={() => onSelect(store)}>
              <span className={styles.person}>
                <Icon icon={faStore} />
              </span>
              <span className={styles.personInfo}>
                <strong>{store.name}</strong>
                <small>
                  {store.category} · {store.city} · Enviada em{" "}
                  {date(store.created_at)}
                </small>
              </span>
              <span className={styles.vehicle}>
                <Icon icon={faBowlFood} />
                {store.is_open ? "Aberta" : "Fechada"}
              </span>
              <b data-status={store.status}>
                {store.status === "pending"
                  ? "Em análise"
                  : store.status === "approved"
                    ? "Aprovada"
                    : "Recusada"}
              </b>
              <Icon icon={faChevronRight} />
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <span>
            <Icon icon={filter === "pending" ? faCircleCheck : faStore} />
          </span>
          <h3>{filter === "pending" ? "Fila em dia" : "Nenhuma loja aqui"}</h3>
          <p>
            {filter === "pending"
              ? "Não há novas lojas esperando análise."
              : "Os cadastros aparecem conforme o status selecionado."}
          </p>
        </div>
      )}
    </section>
  );
}

export function AdminPage() {
  const account = useAccount();
  const [applications, setApplications] = useState([]);
  const [section, setSection] = useState("drivers");
  const [stores, setStores] = useState([]);
  const [storeFilter, setStoreFilter] = useState("pending");
  const [selectedStore, setSelectedStore] = useState(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [notificationPopup, setNotificationPopup] = useState(null);
  const knownApplicationIds = useRef(null);
  const knownStoreIds = useRef(null);

  useEffect(() => {
    document.title = "Painel administrativo — TigreFood";
  }, []);

  const load = useCallback(async (silent = false) => {
    if (account.role !== "admin") return;
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from("driver_applications")
      .select(
        "id, user_id, phone, vehicle_type, vehicle_plate, city, status, review_notes, submitted_at, reviewed_at, profiles!driver_applications_user_id_fkey(full_name, cpf, avatar_url)",
      )
      .order("submitted_at", { ascending: false });
    const applicationRows = data || [];
    const userIds = applicationRows.map((item) => item.user_id);
    const identityResult = userIds.length
      ? await supabase
          .from("driver_identity_verifications")
          .select("user_id, status, failure_reason, verified_at, selfie_path")
          .in("user_id", userIds)
      : { data: [], error: null };
    const identityByUser = Object.fromEntries(
      (identityResult.data || []).map((item) => [item.user_id, item]),
    );
    setApplications(
      applicationRows.map((item) => ({
        ...item,
        identity: identityByUser[item.user_id] || null,
      })),
    );
    if (error) setNotice("Não foi possível carregar os cadastros.");
    else if (!silent) setNotice("");
    if (!silent) setLoading(false);
  }, [account.role]);

  const loadStores = useCallback(async (silent = false) => {
    if (account.role !== "admin") return;
    if (!silent) setStoreLoading(true);
    const { data, error } = await supabase
      .from("stores")
      .select(
        "id, owner_id, name, category, cnpj, phone, city, address, description, status, review_notes, is_open, created_at",
      )
      .order("created_at", { ascending: false });
    setStores(data || []);
    if (error) setNotice("Não foi possível carregar os cadastros de lojas.");
    if (!silent) setStoreLoading(false);
  }, [account.role]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);
  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadStores(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadStores]);

  const presentNotification = useCallback((title, body) => {
    setNotificationPopup({ id: Date.now(), title, body });
    deliverAdminNotification({ title, body, tag: `tigredelivery-${Date.now()}` });
  }, []);

  useEffect(() => {
    if (!notificationPopup) return undefined;
    const timeout = window.setTimeout(() => setNotificationPopup(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [notificationPopup]);

  useEffect(() => {
    if (loading) return;
    const currentIds = new Set(applications.map((item) => item.id));
    if (knownApplicationIds.current === null) {
      knownApplicationIds.current = currentIds;
      return;
    }
    const fresh = applications.filter((item) => !knownApplicationIds.current.has(item.id));
    knownApplicationIds.current = currentIds;
    if (!fresh.length) return;
    const city = fresh[0]?.city ? ` em ${fresh[0].city}` : "";
    presentNotification(
      fresh.length > 1 ? `${fresh.length} novos cadastros de motoristas` : "Novo cadastro de motorista",
      `Há ${fresh.length > 1 ? "novas solicitações" : "uma nova solicitação"}${city} esperando análise.`,
    );
  }, [applications, loading, presentNotification]);

  useEffect(() => {
    if (storeLoading) return;
    const currentIds = new Set(stores.map((item) => item.id));
    if (knownStoreIds.current === null) {
      knownStoreIds.current = currentIds;
      return;
    }
    const fresh = stores.filter((item) => !knownStoreIds.current.has(item.id));
    knownStoreIds.current = currentIds;
    if (!fresh.length) return;
    presentNotification(
      fresh.length > 1 ? `${fresh.length} novas lojas parceiras` : "Nova loja parceira",
      fresh.length > 1
        ? "Novos cadastros de lojas estão esperando análise."
        : `${fresh[0]?.name || "Uma nova loja"} enviou um cadastro para análise.`,
    );
  }, [presentNotification, storeLoading, stores]);

  useEffect(() => {
    if (account.role !== "admin" || !account.user?.id) return undefined;
    const channel = supabase
      .channel(`admin-notifications-${account.user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "driver_applications" },
        () => load(true),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stores" },
        () => loadStores(true),
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [account.role, account.user?.id, load, loadStores]);

  useEffect(() => {
    if (account.role !== "admin") return undefined;
    const polling = window.setInterval(() => {
      load(true);
      loadStores(true);
    }, 30000);
    return () => window.clearInterval(polling);
  }, [account.role, load, loadStores]);

  async function testNotification() {
    const soundPromise = playNotificationSound();
    const permission = await requestNotificationPermission();
    await soundPromise;
    const title = "Notificações ativadas";
    const body = "O painel vai avisar quando chegar um novo cadastro.";
    setNotificationPopup({ id: Date.now(), title, body });
    if (permission === "granted") {
      await showSystemNotification({ title: "TigreDelivery Admin", body, tag: "tigredelivery-test" });
      setNotice("Teste enviado. Som e notificações estão ativados.");
    } else if (permission === "unsupported") {
      setNotice("O som funcionou, mas este navegador não oferece notificações do sistema.");
    } else {
      setNotice("O som funcionou. Libere as notificações nas configurações do navegador para receber popups do sistema.");
    }
  }

  const counts = useMemo(
    () => ({
      all: applications.length,
      pending: applications.filter((item) => item.status === "pending").length,
      approved: applications.filter((item) => item.status === "approved")
        .length,
      rejected: applications.filter(
        (item) => item.status === "rejected" || item.status === "suspended",
      ).length,
    }),
    [applications],
  );
  const visible = applications.filter(
    (item) =>
      filter === "all" ||
      (filter === "rejected"
        ? ["rejected", "suspended"].includes(item.status)
        : item.status === filter),
  );
  const storeCounts = useMemo(
    () => ({
      all: stores.length,
      pending: stores.filter((item) => item.status === "pending").length,
      approved: stores.filter((item) => item.status === "approved").length,
      rejected: stores.filter((item) =>
        ["rejected", "suspended"].includes(item.status),
      ).length,
    }),
    [stores],
  );

  async function review(status, notes) {
    setSaving(true);
    const { error } = await supabase.rpc("review_driver_application", {
      p_application_id: selected.id,
      p_status: status,
      p_notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      setNotice(
        error.message?.includes("identity_verification_required")
          ? "A verificação de identidade precisa estar conferida antes da aprovação."
          : "Não foi possível salvar a decisão. Tente novamente.",
      );
      return;
    }
    setSelected(null);
    setNotice(
      status === "approved"
        ? "Motorista aprovado e acesso liberado."
        : "Cadastro devolvido para correção.",
    );
    await load();
  }

  async function reviewStore(status, notes) {
    setSaving(true);
    const { error } = await supabase.rpc("review_store_application", {
      p_store_id: selectedStore.id,
      p_status: status,
      p_notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      setNotice("Não foi possível salvar a decisão da loja. Tente novamente.");
      return;
    }
    setSelectedStore(null);
    setNotice(
      status === "approved"
        ? "Loja aprovada e acesso liberado."
        : "Cadastro da loja devolvido para correção.",
    );
    await loadStores();
  }

  async function reviewIdentity(status) {
    setSaving(true);
    const selfiePath = selected?.identity?.selfie_path;
    const { error } = await supabase.rpc("review_driver_identity", {
      p_user_id: selected.user_id,
      p_status: status,
    });
    if (!error && selfiePath)
      await supabase.storage.from("driver-selfies").remove([selfiePath]);
    setSaving(false);
    if (error) {
      setNotice(
        "Não foi possível salvar a análise do rosto. A migration do modo de teste precisa estar aplicada.",
      );
      return;
    }
    setSelected(null);
    setNotice(
      status === "verified"
        ? "Rosto conferido. Agora o motorista pode ser aprovado."
        : "Foi solicitada uma nova captura de rosto.",
    );
    await load();
  }

  if (account.loading || account.role !== "admin")
    return <AccessState account={account} />;

  const currentCounts = section === "drivers" ? counts : storeCounts;
  const sectionName = section === "drivers" ? "motoristas" : "lojas";
  const adminName = account.profile?.full_name || "Administrador TigreFood";
  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span>
            <Icon icon={faShieldHalved} />
          </span>
          <div>
            <strong>TigreFood</strong>
            <small>Operações</small>
          </div>
        </div>
        <nav>
          <button
            className={section === "drivers" ? styles.navActive : ""}
            onClick={() => setSection("drivers")}
          >
            <Icon icon={faMotorcycle} />
            Motoristas
          </button>
          <button
            className={section === "stores" ? styles.navActive : ""}
            onClick={() => setSection("stores")}
          >
            <Icon icon={faStore} />
            Lojas
            {storeCounts.pending > 0 && <small>{storeCounts.pending}</small>}
          </button>
        </nav>
        <a href="#catalogo">
          <Icon icon={faArrowLeft} />
          Voltar ao aplicativo
        </a>
      </aside>
      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <small>Operação TigreFood</small>
            <h1>{section === "drivers" ? "Motoristas" : "Lojas parceiras"}</h1>
          </div>
          <div className={styles.topbarActions}>
            <button className={styles.testNotification} onClick={testNotification}><Icon icon={faBell} /><span>Testar notificação</span></button>
            <div className={styles.adminIdentity}>
            <div><strong>{adminName}</strong><small>Administrador</small></div>
            <span className={styles.adminAvatar}>
              {account.profile?.avatar_url ? (
                <img
                  src={account.profile.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Icon icon={faUser} />
              )}
            </span>
            </div>
          </div>
        </header>
        <div className={styles.content}>
          <section className={styles.pageLead}>
            <div><span>{today}</span><h2>Fila de {sectionName}</h2><p>Revise somente o que precisa de decisão e acompanhe o que já foi liberado.</p></div>
            <div className={styles.syncState}><i />Dados atualizados</div>
          </section>
          <section className={styles.summary}>
            <article className={styles.summaryPriority}>
              <span><Icon icon={faUserClock} /></span>
              <div><small>Precisam de análise</small><strong>{currentCounts.pending}</strong></div>
              <em>{currentCounts.pending ? "Ação necessária" : "Fila em dia"}</em>
            </article>
            <article>
              <span><Icon icon={faCircleCheck} /></span>
              <div><small>Aprovados</small><strong>{currentCounts.approved}</strong></div>
            </article>
            <article>
              <span><Icon icon={faUsers} /></span>
              <div><small>Total recebido</small><strong>{currentCounts.all}</strong></div>
            </article>
          </section>
          {section === "stores" ? (
            <StoreQueue
              stores={stores}
              loading={storeLoading}
              filter={storeFilter}
              setFilter={setStoreFilter}
              counts={storeCounts}
              notice={notice}
              onRefresh={loadStores}
              onSelect={setSelectedStore}
            />
          ) : (
            <>
              <section className={styles.queue}>
                <header>
                  <div>
                    <h2>Fila de cadastros</h2>
                    <p>
                      Confira os dados antes de liberar o acesso de motorista.
                    </p>
                  </div>
                  <button onClick={load} aria-label="Atualizar">
                    <Icon icon={faRotate} />
                    Atualizar
                  </button>
                </header>
                <div className={styles.filters}>
                  {filters.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setFilter(item.id)}
                      className={filter === item.id ? styles.filterActive : ""}
                    >
                      {item.label}
                      <span>{counts[item.id]}</span>
                    </button>
                  ))}
                </div>
                {notice && <p className={styles.notice}>{notice}</p>}
                {loading ? (
                  <div className={styles.skeleton}>
                    <i />
                    <i />
                    <i />
                  </div>
                ) : visible.length ? (
                  <div className={styles.applicationList}>
                    {visible.map((application) => {
                      const profile = application.profiles || {};
                      const vehicle =
                        vehicleInfo[application.vehicle_type] ||
                        vehicleInfo.motorcycle;
                      return (
                        <button
                          key={application.id}
                          onClick={() => setSelected(application)}
                        >
                          <span className={styles.person}>
                            {profile.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                alt=""
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Icon icon={faUser} />
                            )}
                          </span>
                          <span className={styles.personInfo}>
                            <strong>
                              {profile.full_name || "Nome não informado"}
                            </strong>
                            <small>
                              {application.city} · Enviado em{" "}
                              {date(application.submitted_at)}
                            </small>
                          </span>
                          <span className={styles.vehicle}>
                            <Icon icon={vehicle.icon} />
                            {vehicle.label}
                          </span>
                          <span
                            className={`${styles.identityList} ${application.identity?.status === "verified" ? styles.identityListVerified : ""}`}
                          >
                            <Icon icon={faShieldHalved} />
                            {application.identity?.status === "verified"
                              ? "Identidade conferida"
                              : application.identity?.status === "pending"
                                ? "Identidade em análise"
                                : "Identidade pendente"}
                          </span>
                          <b data-status={application.status}>
                            {statusLabel[application.status]}
                          </b>
                          <Icon icon={faChevronRight} />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.empty}>
                    <span>
                      <Icon
                        icon={filter === "pending" ? faCircleCheck : faUsers}
                      />
                    </span>
                    <h3>
                      {filter === "pending"
                        ? "Fila em dia"
                        : "Nenhum cadastro aqui"}
                    </h3>
                    <p>
                      {filter === "pending"
                        ? "Não há novos entregadores esperando análise."
                        : "Os cadastros aparecem aqui conforme o status selecionado."}
                    </p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </section>
      <AnimatePresence>{notificationPopup && <motion.aside key={notificationPopup.id} className={styles.notificationPopup} role="alert" initial={{ opacity: 0, y: -14, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 24, scale: .98 }} transition={{ duration: .22 }}>
        <span><Icon icon={faBell} /></span><div><strong>{notificationPopup.title}</strong><p>{notificationPopup.body}</p></div><button onClick={() => setNotificationPopup(null)} aria-label="Fechar notificação"><Icon icon={faXmark} /></button>
      </motion.aside>}</AnimatePresence>
      <AnimatePresence>
        {selected && (
          <ReviewPanel
            application={selected}
            onClose={() => setSelected(null)}
            onReview={review}
            onIdentityReview={reviewIdentity}
            saving={saving}
          />
        )}
        {selectedStore && (
          <StoreReviewPanel
            store={selectedStore}
            onClose={() => setSelectedStore(null)}
            onReview={reviewStore}
            saving={saving}
          />
        )}
        {saving && (
          <LoadingOverlay
            label="Quase lá"
            detail="Salvando a decisão deste cadastro."
          />
        )}
      </AnimatePresence>
    </main>
  );
}

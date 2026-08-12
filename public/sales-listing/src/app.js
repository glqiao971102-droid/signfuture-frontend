const STORAGE_KEY = "sales-performance-ledger-v3-clean";
const LEGACY_KEY = "sales-ledger-pro-v1";
const DEFAULT_SALESPEOPLE = ["Rayson", "Galvin", "Jiro"];
const COST_TYPES = ["Sign Future", "S&Y Printing", "Lalamove", "Purchase"];
const FACEBOOK_STATUSES = ["Follow Up 1", "Follow Up 2", "Follow Up 3", "Progressing", "Deal", "Fail"];
const DEFAULT_FACEBOOK_POSTS = ["最靓招牌", "省钱招牌"];
const DEFAULT_LOGO_IMAGE = "src/sign-future-logo.jpg";
const DEFAULT_SALES_PERSON_IMAGE = "src/sales-person-mascot.jpg";
const currency = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });

let state = loadState();
let activeView = "dashboard";
let selectionMode = { invoices: false, costs: false };
let invoiceLedgerSort = "date-desc";
let costLedgerSort = "date-desc";
let costTypeFilter = "All";
let editingSalesPersonImage = "";
let editingAvatarTier = "";
let installationMapState = { lat: 4.2, lng: 109.5, zoom: 6 };
let installationMapDrag = null;
let installationMapUserAdjusted = false;
let installationCalendarMonth = "";
// Month filter for the Installation Jobs LIST (separate from the calendar).
// "" = show every month.
let installationJobsMonth = "";

const els = {
  dateFromFilter: document.querySelector("#dateFromFilter"),
  dateToFilter: document.querySelector("#dateToFilter"),
  salespersonFilter: document.querySelector("#salespersonFilter"),
  newSalespersonName: document.querySelector("#newSalespersonName"),
  searchInput: document.querySelector("#searchInput"),
  importType: document.querySelector("#importType"),
  importSalesperson: document.querySelector("#importSalesperson"),
  importMonth: document.querySelector("#importMonth"),
  invoiceReportInput: document.querySelector("#invoiceReportInput"),
  importStatus: document.querySelector("#importStatus"),
  brandLogo: document.querySelector("#brandLogo"),
  logoPreview: document.querySelector("#logoPreview"),
  logoImageInput: document.querySelector("#logoImageInput"),
  salesPersonImageInput: document.querySelector("#salesPersonImageInput"),
  avatarTierImageInput: document.querySelector("#avatarTierImageInput"),
  avatarDefaultPreview: document.querySelector("#avatarDefaultPreview"),
  avatar20Preview: document.querySelector("#avatar20Preview"),
  avatar50Preview: document.querySelector("#avatar50Preview"),
  avatar100Preview: document.querySelector("#avatar100Preview"),
  viewTitle: document.querySelector("#viewTitle"),
  kpiGrid: document.querySelector("#kpiGrid"),
  dashboardScope: document.querySelector("#dashboardScope"),
  salespersonCards: document.querySelector("#salespersonCards"),
  costTypeBars: document.querySelector("#costTypeBars"),
  targetChart: document.querySelector("#targetChart"),
  targetSummary: document.querySelector("#targetSummary"),
  latestInvoices: document.querySelector("#latestInvoices"),
  scorecardMetrics: document.querySelector("#scorecardMetrics"),
  scorecardTitle: document.querySelector("#scorecardTitle"),
  scorecardSubtitle: document.querySelector("#scorecardSubtitle"),
  scorecardCommission: document.querySelector("#scorecardCommission"),
  scorecardProfitActual: document.querySelector("#scorecardProfitActual"),
  scorecardSalesActual: document.querySelector("#scorecardSalesActual"),
  scorecardProfitProgress: document.querySelector("#scorecardProfitProgress"),
  scorecardSalesProgress: document.querySelector("#scorecardSalesProgress"),
  scorecardPayout: document.querySelector("#scorecardPayout"),
  scorecardNote: document.querySelector("#scorecardNote"),
  scorecardSalesperson: document.querySelector("#scorecardSalesperson"),
  scorecardMonth: document.querySelector("#scorecardMonth"),
  scorecardRate: document.querySelector("#scorecardRate"),
  scorecardRateInput: document.querySelector("#scorecardRateInput"),
  scorecardDetailDialog: document.querySelector("#scorecardDetailDialog"),
  scorecardDetailTitle: document.querySelector("#scorecardDetailTitle"),
  scorecardDetailSummary: document.querySelector("#scorecardDetailSummary"),
  scorecardDetailBody: document.querySelector("#scorecardDetailBody"),
  scorecardDetailClose: document.querySelector("#scorecardDetailClose"),
  emptyHero: document.querySelector("#emptyHero"),
  invoiceEmpty: document.querySelector("#invoiceEmpty"),
  costEmpty: document.querySelector("#costEmpty"),
  trashEmpty: document.querySelector("#trashEmpty"),
  invoiceSummary: document.querySelector("#invoiceSummary"),
  costSummary: document.querySelector("#costSummary"),
  installationSummary: document.querySelector("#installationSummary"),
  installationJobCount: document.querySelector("#installationJobCount"),
  trashSummary: document.querySelector("#trashSummary"),
  invoiceBody: document.querySelector("#invoiceBody"),
  costBody: document.querySelector("#costBody"),
  installationJobs: document.querySelector("#installationJobs"),
  installationJobsMonthInput: document.querySelector("#installationJobsMonthInput"),
  installationJobsMonthClear: document.querySelector("#installationJobsMonthClear"),
  installationJobsMonthNote: document.querySelector("#installationJobsMonthNote"),
  installationCalendar: document.querySelector("#installationCalendar"),
  installationCalendarMonth: document.querySelector("#installationCalendarMonth"),
  installationCalendarMonthInput: document.querySelector("#installationCalendarMonthInput"),
  installationCalendarPrev: document.querySelector("#installationCalendarPrev"),
  installationCalendarNext: document.querySelector("#installationCalendarNext"),
  installationMap: document.querySelector("#installationMap"),
  installationMapTiles: document.querySelector("#installationMapTiles"),
  installationMapMarkers: document.querySelector("#installationMapMarkers"),
  installationMapZoomIn: document.querySelector("#installationMapZoomIn"),
  installationMapZoomOut: document.querySelector("#installationMapZoomOut"),
  installationMapReset: document.querySelector("#installationMapReset"),
  installationEmpty: document.querySelector("#installationEmpty"),
  trashBody: document.querySelector("#trashBody"),
  salespersonManagerBody: document.querySelector("#salespersonManagerBody"),
  trendSummary: document.querySelector("#trendSummary"),
  invoiceForm: document.querySelector("#invoiceForm"),
  invoiceJobType: document.querySelector("#invoiceJobType"),
  invoiceInstallationFields: document.querySelector("#invoiceInstallationFields"),
  installationAddress: document.querySelector("#installationAddress"),
  installationPostcode: document.querySelector("#installationPostcode"),
  installationState: document.querySelector("#installationState"),
  installationDate: document.querySelector("#installationDate"),
  installationStartTime: document.querySelector("#installationStartTime"),
  installationEndTime: document.querySelector("#installationEndTime"),
  costForm: document.querySelector("#costForm"),
  salesPersonEditPanel: document.querySelector("#salesPersonEditPanel"),
  editingSalespersonOriginalName: document.querySelector("#editingSalespersonOriginalName"),
  editingSalespersonName: document.querySelector("#editingSalespersonName"),
  editingSalespersonImage: document.querySelector("#editingSalespersonImage"),
  salesPersonEditPreview: document.querySelector("#salesPersonEditPreview"),
  linkedInvoice: document.querySelector("#linkedInvoice"),
  linkedPreview: document.querySelector("#linkedPreview"),
  invoiceModeLabel: document.querySelector("#invoiceModeLabel"),
  costModeLabel: document.querySelector("#costModeLabel"),
  tickDateDialog: document.querySelector("#tickDateDialog"),
  tickDateTitle: document.querySelector("#tickDateTitle"),
  tickDateMessage: document.querySelector("#tickDateMessage"),
  tickDateInput: document.querySelector("#tickDateInput"),
  tickDateConfirm: document.querySelector("#tickDateConfirm"),
  tickDateCancel: document.querySelector("#tickDateCancel"),
  advertisingCostDialog: document.querySelector("#advertisingCostDialog"),
  advertisingCostMessage: document.querySelector("#advertisingCostMessage"),
  advertisingCostInput: document.querySelector("#advertisingCostInput"),
  advertisingCostConfirm: document.querySelector("#advertisingCostConfirm"),
  advertisingCostCancel: document.querySelector("#advertisingCostCancel"),
  jsonTransferDialog: document.querySelector("#jsonTransferDialog"),
  jsonTransferTitle: document.querySelector("#jsonTransferTitle"),
  jsonTransferMessage: document.querySelector("#jsonTransferMessage"),
  jsonTransferText: document.querySelector("#jsonTransferText"),
  jsonCopyButton: document.querySelector("#jsonCopyButton"),
  jsonRestoreButton: document.querySelector("#jsonRestoreButton"),
  jsonCloseButton: document.querySelector("#jsonCloseButton"),
  facebookSalespersonFilter: document.querySelector("#facebookSalespersonFilter"),
  facebookStatusFilter: document.querySelector("#facebookStatusFilter"),
  facebookListingInput: document.querySelector("#facebookListingInput"),
  addFacebookCustomerButton: document.querySelector("#addFacebookCustomerButton"),
  facebookSummary: document.querySelector("#facebookSummary"),
  facebookStatusCards: document.querySelector("#facebookStatusCards"),
  facebookCashCards: document.querySelector("#facebookCashCards"),
  facebookPostSummary: document.querySelector("#facebookPostSummary"),
  facebookBody: document.querySelector("#facebookBody"),
  facebookEmpty: document.querySelector("#facebookEmpty"),
  facebookForm: document.querySelector("#facebookForm"),
  facebookId: document.querySelector("#facebookId"),
  facebookModeLabel: document.querySelector("#facebookModeLabel"),
  facebookDate: document.querySelector("#facebookDate"),
  facebookCustomerNumber: document.querySelector("#facebookCustomerNumber"),
  facebookPost: document.querySelector("#facebookPost"),
  facebookPostManageButton: document.querySelector("#facebookPostManageButton"),
  facebookPostDialog: document.querySelector("#facebookPostDialog"),
  facebookPostDialogClose: document.querySelector("#facebookPostDialogClose"),
  facebookPostNameInput: document.querySelector("#facebookPostNameInput"),
  facebookPostDeleteSelect: document.querySelector("#facebookPostDeleteSelect"),
  facebookPostAddConfirm: document.querySelector("#facebookPostAddConfirm"),
  facebookPostDeleteConfirm: document.querySelector("#facebookPostDeleteConfirm"),
  facebookSource: document.querySelector("#facebookSource"),
  facebookSalespersonInput: document.querySelector("#facebookSalespersonInput"),
  facebookStatusInput: document.querySelector("#facebookStatusInput"),
  clearFacebookButton: document.querySelector("#clearFacebookButton"),
  closeFacebookButton: document.querySelector("#closeFacebookButton"),
  agentNameInput: document.querySelector("#agentNameInput"),
  agentSalespersonSelect: document.querySelector("#agentSalespersonSelect"),
  addAgentButton: document.querySelector("#addAgentButton"),
  agentTableBody: document.querySelector("#agentTableBody"),
  accountDetailForm: document.querySelector("#accountDetailForm"),
  accountNameInput: document.querySelector("#accountNameInput"),
  accountEmailInput: document.querySelector("#accountEmailInput"),
  accountAddressInput: document.querySelector("#accountAddressInput"),
  accountPhoneInput: document.querySelector("#accountPhoneInput"),
  accountNewPasswordInput: document.querySelector("#accountNewPasswordInput"),
  accountConfirmPasswordInput: document.querySelector("#accountConfirmPasswordInput"),
  accountSaveStatus: document.querySelector("#accountSaveStatus"),
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return normalizeState(JSON.parse(saved));

  return normalizeState({ invoices: [], costs: [] });
}

function normalizeState(input) {
  return {
    invoices: (input.invoices || []).map((invoice) => {
      const jobType = invoice.jobType === "installation" ? "installation" : "supply";
      const row = {
        agentOrder: 0,
        outstanding: 0,
        settled: false,
        settledAt: "",
        trashedAt: "",
        ...invoice,
        jobType,
        installation: normalizeInstallation(invoice.installation, jobType),
      };
      if (/^Imported from /i.test(row.note || "")) row.note = "";
      if (row.settled && !row.settledAt) row.settledAt = todayInputValue();
      return row;
    }),
    costs: (input.costs || []).map((cost) => ({ lateCost: false, lateCostAt: "", trashedAt: "", linkedInvoiceNo: "", owner: "", ...cost })),
    facebookListings: (input.facebookListings || []).map((row) => ({
      id: row.id || createId(),
      no: row.no || "",
      invoiceNo: row.invoiceNo || "",
      date: row.date || "",
      customerNumber: row.customerNumber || "",
      post: row.post || "",
      source: row.source || row.from || "",
      salesperson: row.salesperson || "",
      dealDateline: row.dealDateline || "",
      invoiceMonth: row.invoiceMonth || "",
      amount: Number(row.amount || 0),
      outstanding: Number(row.outstanding || 0),
      status: row.status || "",
      statusUpdatedAt: row.statusUpdatedAt || row.statusDate || row.statusAt || "",
      remarks: row.remarks || "",
      importedFrom: row.importedFrom || "",
    })),
    // Manually-added installations (Add New Installation) — standalone jobs that
    // are not tied to an invoice. Shown in the Installation Jobs list + calendar.
    installations: (input.installations || []).map((it) => ({
      id: it.id || createId(),
      manual: true,
      invoiceNo: it.invoiceNo || "",
      installerPhone: it.installerPhone || "",
      customerPhone: it.customerPhone || "",
      date: it.date || "",
      startTime: it.startTime || it.time || "",
      endTime: it.endTime || "",
      completed: !!it.completed,
      completedAt: it.completedAt || "",
      createdAt: it.createdAt || "",
    })),
    settings: {
      logoImage: input.settings?.logoImage || DEFAULT_LOGO_IMAGE,
      salesPersonImage: input.settings?.salesPersonImage || DEFAULT_SALES_PERSON_IMAGE,
      salesPersonImages: input.settings?.salesPersonImages || {},
      salesPersonAvatarTiers: {
        default: input.settings?.salesPersonAvatarTiers?.default || input.settings?.salesPersonImage || DEFAULT_SALES_PERSON_IMAGE,
        tier20: input.settings?.salesPersonAvatarTiers?.tier20 || "",
        tier50: input.settings?.salesPersonAvatarTiers?.tier50 || "",
        tier100: input.settings?.salesPersonAvatarTiers?.tier100 || "",
      },
      commissionRate: Number.isFinite(Number(input.settings?.commissionRate)) ? Number(input.settings.commissionRate) : 20,
      advertisingCosts: input.settings?.advertisingCosts || {},
      salespeople: normalizeSalespeople(input.settings?.salespeople || DEFAULT_SALESPEOPLE),
      facebookPosts: normalizeFacebookPosts(input.settings?.facebookPosts || DEFAULT_FACEBOOK_POSTS),
      agents: (input.settings?.agents || []).map((agent) => ({
        id: agent.id || createId(),
        name: cleanText(agent.name),
        salesperson: cleanText(agent.salesperson),
      })).filter((agent) => agent.name),
      accountDetail: {
        name: cleanText(input.settings?.accountDetail?.name),
        email: cleanText(input.settings?.accountDetail?.email),
        address: cleanText(input.settings?.accountDetail?.address),
        phoneNumber: cleanText(input.settings?.accountDetail?.phoneNumber || input.settings?.accountDetail?.phoneNumbers?.[0]),
        passwordUpdatedAt: input.settings?.accountDetail?.passwordUpdatedAt || "",
      },
    },
  };
}

function normalizeSalespeople(names) {
  const cleaned = names.map((name) => cleanText(name)).filter(Boolean);
  return [...new Set(cleaned)];
}

function normalizeFacebookPosts(names) {
  const cleaned = names.map((name) => cleanText(name)).filter(Boolean);
  return [...new Set(cleaned.length ? cleaned : DEFAULT_FACEBOOK_POSTS)];
}

function malaysiaPostcodeLocation(postcode) {
  const code = Number(String(postcode || "").slice(0, 5));
  if (!Number.isFinite(code)) return { state: "" };
  const ranges = [
    { from: 1000, to: 2800, state: "Perlis" },
    { from: 5000, to: 9899, state: "Kedah" },
    { from: 10000, to: 14400, state: "Pulau Pinang" },
    { from: 15000, to: 18500, state: "Kelantan" },
    { from: 20000, to: 24300, state: "Terengganu" },
    { from: 25000, to: 28800, state: "Pahang" },
    { from: 30000, to: 36800, state: "Perak" },
    { from: 39000, to: 39200, state: "Pahang" },
    { from: 40000, to: 48300, state: "Selangor" },
    { from: 50000, to: 60000, state: "Kuala Lumpur" },
    { from: 62000, to: 62999, state: "Putrajaya" },
    { from: 63000, to: 68100, state: "Selangor" },
    { from: 70000, to: 73509, state: "Negeri Sembilan" },
    { from: 75000, to: 78309, state: "Melaka" },
    { from: 79000, to: 86900, state: "Johor" },
    { from: 87000, to: 87033, state: "Labuan" },
    { from: 88000, to: 91309, state: "Sabah" },
    { from: 93000, to: 98859, state: "Sarawak" },
  ];
  const match = ranges.find((range) => code >= range.from && code <= range.to);
  return match ? { state: match.state } : { state: "" };
}

function normalizeInstallation(input = {}, jobType = "supply") {
  const postcode = cleanText(input.postcode);
  const location = malaysiaPostcodeLocation(postcode);
  return {
    address: cleanText(input.address),
    postcode,
    state: cleanText(input.state || location.state),
    date: input.date || "",
    startTime: input.startTime || "",
    endTime: input.endTime || "",
    completed: jobType === "installation" ? Boolean(input.completed) : false,
    completedAt: input.completedAt || "",
  };
}

function getSalespeople() {
  return state.settings.salespeople?.length ? state.settings.salespeople : DEFAULT_SALESPEOPLE;
}

function migrateRecords(records) {
  const invoices = [];
  const costs = [];

  records
    .filter((row) => getSalespeople().includes(row.salesperson))
    .forEach((row) => {
      const invoiceId = row.id || createId();
      invoices.push({
        id: invoiceId,
        invoiceNo: row.docNo,
        date: row.date,
        salesperson: row.salesperson,
        customer: row.customer || "",
        amount: Number(row.revenue || 0),
        outstanding: Number(row.outstanding || 0),
        note: row.lateBill || "",
      });

      Object.entries(row.costs || {}).forEach(([type, amount], index) => {
        if (!Number(amount || 0)) return;
        costs.push({
          id: createId(),
          invoiceId,
          type: normalizeCostType(type),
          docNo: `${type.replaceAll(" ", "").slice(0, 3).toUpperCase()}-${row.docNo}-${index + 1}`,
          date: row.date,
          amount: Number(amount || 0),
          note: "Imported from Excel",
        });
      });
    });

  return { invoices, costs };
}

function normalizeCostType(type) {
  if (COST_TYPES.includes(type)) return type;
  if (type.toLowerCase().includes("lalamove")) return "Lalamove";
  if (type.toLowerCase().includes("printing")) return "S&Y Printing";
  if (type.toLowerCase().includes("sign")) return "Sign Future";
  return "Purchase";
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getFilters() {
  return {
    dateFrom: els.dateFromFilter.value,
    dateTo: els.dateToFilter.value,
    filterMonth: selectedFilterMonth(),
    salesperson: els.salespersonFilter.value,
    search: els.searchInput.value.trim().toLowerCase(),
  };
}

function selectedFilterMonth() {
  return (els.dateFromFilter.value || els.dateToFilter.value || "").slice(0, 7);
}

function selectedImportMonth() {
  return els.importMonth.value || selectedFilterMonth();
}

function todayInputValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function monthOf(date) {
  return String(date || "").slice(0, 7);
}

function formatTickDate(date) {
  if (!date) return "";
  const [, year, month, day] = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
  return month && day && year ? `${day}/${month}/${year}` : date;
}

function invoiceCosts(invoiceOrId) {
  const invoice = typeof invoiceOrId === "object" ? invoiceOrId : findInvoice(invoiceOrId);
  const invoiceId = typeof invoiceOrId === "object" ? invoiceOrId.id : invoiceOrId;
  const invoiceNo = cleanText(invoice?.invoiceNo).toUpperCase();
  return state.costs.filter((cost) => {
    if (cost.trashedAt) return false;
    const linkedNo = normalizeLinkedInvoiceNo(cost.linkedInvoiceNo).toUpperCase();
    return cost.invoiceId === invoiceId || (invoiceNo && linkedNo === invoiceNo);
  });
}

function allInvoiceCosts(invoiceId) {
  return state.costs.filter((cost) => cost.invoiceId === invoiceId);
}

function invoiceCostTotal(invoiceOrId) {
  return invoiceCosts(invoiceOrId).reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
}

function invoiceCostTypeTotal(invoiceOrId, type) {
  return invoiceCosts(invoiceOrId)
    .filter((cost) => cost.type === type)
    .reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
}

function costValueCell(amount) {
  return `<td class="num ${Number(amount || 0) ? "recorded-cost" : ""}">${currency.format(amount)}</td>`;
}

function invoiceRowStatusClass(invoice) {
  if (invoice.settled && invoiceHasUnmarkedLateCost(invoice)) return "invoice-row-late-cost";
  if (invoice.settled) return "invoice-row-settled";
  return Number(invoice.outstanding || 0) ? "invoice-row-outstanding" : "invoice-row-paid";
}

function invoiceHasUnmarkedLateCost(invoice) {
  const sourceMonth = (invoice.date || "").slice(0, 7) || invoiceMonth(invoice.invoiceNo);
  if (!sourceMonth) return false;
  return invoiceCosts(invoice).some((cost) => {
    const costMonth = (cost.date || "").slice(0, 7);
    return costMonth && costMonth > sourceMonth && !costStatusChecked(cost, invoice);
  });
}

function invoiceProfit(invoice) {
  return Number(invoice.amount || 0) - invoiceCostTotal(invoice);
}

function invoiceMargin(invoice) {
  return Number(invoice.amount || 0) ? (invoiceProfit(invoice) / Number(invoice.amount || 0)) * 100 : 0;
}

function getFilteredInvoices() {
  const filters = getFilters();
  return state.invoices.filter((invoice) => {
    if (invoice.trashedAt) return false;
    const matchesDate = matchesDateRange(invoice.date, filters);
    const matchesPerson = filters.salesperson === "All" || invoice.salesperson === filters.salesperson;
    const costDocs = invoiceCosts(invoice.id).map((cost) => cost.docNo).join(" ");
    const searchable = `${invoice.invoiceNo} ${invoice.customer} ${invoice.salesperson} ${costDocs}`.toLowerCase();
    return matchesDate && matchesPerson && searchable.includes(filters.search);
  });
}

function getFilteredTrashInvoices() {
  const filters = getFilters();
  return state.invoices.filter((invoice) => {
    if (!invoice.trashedAt) return false;
    const matchesDate = matchesDateRange(invoice.date, filters);
    const matchesPerson = filters.salesperson === "All" || invoice.salesperson === filters.salesperson;
    const costDocs = invoiceCosts(invoice.id).map((cost) => cost.docNo).join(" ");
    const searchable = `${invoice.invoiceNo} ${invoice.customer} ${invoice.salesperson} ${costDocs}`.toLowerCase();
    return matchesDate && matchesPerson && searchable.includes(filters.search);
  });
}

function getFilteredCosts() {
  const filters = getFilters();
  return state.costs.filter((cost) => {
    if (cost.trashedAt) return false;
    const invoice = findInvoice(cost.invoiceId);
    const isCompanyCost = !cost.invoiceId;
    const owner = costOwner(cost, invoice);
    const matchesDate = matchesDateRange(cost.date, filters);
    const matchesPerson =
      filters.salesperson === "All" ||
      (isCompanyCost && owner === filters.salesperson) ||
      invoice?.salesperson === filters.salesperson;
    const searchable = `${cost.docNo} ${cost.type} ${cost.note} ${cost.linkedInvoiceNo || ""} ${invoice?.invoiceNo || ""} ${owner}`.toLowerCase();
    return matchesDate && matchesPerson && searchable.includes(filters.search);
  });
}

function getFilteredFacebookListings() {
  const filters = getFilters();
  const salesperson = els.facebookSalespersonFilter?.value || "All";
  const status = els.facebookStatusFilter?.value || "All";
  return state.facebookListings.filter((row) => {
    // Facebook Listing 不受全局 From/To 日期筛选影响——始终显示全部记录,
    // 只用本页的销售员/状态筛选和搜索来过滤。
    const matchesGlobalPerson = filters.salesperson === "All" || row.salesperson === filters.salesperson;
    const matchesPagePerson = salesperson === "All" || row.salesperson === salesperson;
    const matchesStatus = status === "All" || (status === "Follow Up" ? isFollowUpStatus(row.status) : row.status === status);
    const searchable = [
      row.invoiceNo,
      row.customerNumber,
      row.post,
      row.source,
      row.salesperson,
      row.status,
      row.remarks,
    ].join(" ").toLowerCase();
    return matchesGlobalPerson && matchesPagePerson && matchesStatus && searchable.includes(filters.search);
  });
}

function getFilteredTrashCosts() {
  const filters = getFilters();
  return state.costs.filter((cost) => {
    if (!cost.trashedAt) return false;
    const invoice = findInvoice(cost.invoiceId);
    const isCompanyCost = !cost.invoiceId;
    const owner = costOwner(cost, invoice);
    const matchesDate = matchesDateRange(cost.date, filters);
    const matchesPerson =
      filters.salesperson === "All" ||
      (isCompanyCost && owner === filters.salesperson) ||
      invoice?.salesperson === filters.salesperson;
    const searchable = `${cost.docNo} ${cost.type} ${cost.note} ${cost.linkedInvoiceNo || ""} ${invoice?.invoiceNo || ""} ${owner}`.toLowerCase();
    return matchesDate && matchesPerson && searchable.includes(filters.search);
  });
}

function matchesDateRange(date, filters = getFilters()) {
  if (!date) return false;
  const dates = [filters.dateFrom, filters.dateTo].filter(Boolean).sort();
  const from = dates[0] || "";
  const to = dates[1] || "";
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function costOwner(cost, invoice = findInvoice(cost.invoiceId)) {
  invoice ||= linkedInvoiceForCost(cost);
  if (invoice) return invoice.salesperson;
  if (cost.owner) return cost.owner;
  const linked = normalizeLinkedInvoiceNo(cost.linkedInvoiceNo).toLowerCase();
  const salesperson = getSalespeople().find((name) => linked === name.toLowerCase());
  if (salesperson) return salesperson;
  if (!linked || isProductionValue(linked)) return "Production";
  return "Unlinked";
}

function costLinkLabel(cost, invoice = findInvoice(cost.invoiceId)) {
  invoice ||= linkedInvoiceForCost(cost);
  if (invoice) return invoice.invoiceNo;
  const linked = normalizeLinkedInvoiceNo(cost.linkedInvoiceNo);
  if (!linked || isProductionValue(linked)) return "Production";
  if (linked) return `Unlinked: ${linked}`;
  return "Production";
}

function costRowStatusClass(cost, invoice = linkedInvoiceForCost(cost)) {
  if (costOwner(cost, invoice) === "Unlinked") return "cost-row-unlinked";
  if (invoice?.settled && costStatusChecked(cost, invoice)) return "cost-row-settled";
  if (invoice) return "cost-row-linked";
  return "";
}

function costStatusChecked(cost, invoice = linkedInvoiceForCost(cost)) {
  return Boolean(cost.lateCost || costIncludedWithInvoiceSettlement(cost, invoice));
}

function costIncludedWithInvoiceSettlement(cost, invoice = linkedInvoiceForCost(cost)) {
  if (!invoice?.settled) return false;
  const settledAt = invoice.settledAt || todayInputValue();
  return !cost.date || cost.date <= settledAt;
}

function advertisingCostKey(salesperson, month) {
  return `${salesperson || "Sales Person"}__${month || "unknown"}`;
}

function manualAdvertisingCost(salesperson, month) {
  return Number(state.settings.advertisingCosts?.[advertisingCostKey(salesperson, month)] || 0);
}

function requestTickDate(message, fallback = todayInputValue()) {
  if (!els.tickDateDialog) {
    const value = prompt(message, fallback || todayInputValue());
    if (value === null) return Promise.resolve(null);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return Promise.resolve(value);
    alert("Please enter the date as YYYY-MM-DD.");
    return requestTickDate(message, fallback);
  }

  els.tickDateTitle.textContent = "Choose Tick Date";
  els.tickDateMessage.textContent = message;
  els.tickDateInput.value = fallback || todayInputValue();

  return new Promise((resolve) => {
    const cleanup = (value) => {
      els.tickDateConfirm.removeEventListener("click", confirmDate);
      els.tickDateCancel.removeEventListener("click", cancelDate);
      els.tickDateDialog.removeEventListener("cancel", cancelDate);
      if (els.tickDateDialog.open) els.tickDateDialog.close();
      resolve(value);
    };
    const confirmDate = () => {
      if (!els.tickDateInput.reportValidity()) return;
      cleanup(els.tickDateInput.value);
    };
    const cancelDate = (event) => {
      event?.preventDefault();
      cleanup(null);
    };
    els.tickDateConfirm.addEventListener("click", confirmDate);
    els.tickDateCancel.addEventListener("click", cancelDate);
    els.tickDateDialog.addEventListener("cancel", cancelDate);
    els.tickDateDialog.showModal();
    els.tickDateInput.focus();
  });
}

function isProductionValue(value) {
  return /^production\.?$/i.test(cleanText(value));
}

function findInvoice(id) {
  return state.invoices.find((invoice) => invoice.id === id);
}

function findInvoiceByNo(invoiceNo) {
  const target = normalizeLinkedInvoiceNo(invoiceNo).toUpperCase();
  if (!target) return null;
  return state.invoices.find((invoice) => cleanText(invoice.invoiceNo).toUpperCase() === target) || null;
}

function linkedInvoiceForCost(cost) {
  return findInvoice(cost.invoiceId) || findInvoiceByNo(cost.linkedInvoiceNo);
}

function normalizeLinkedInvoiceNo(value) {
  const text = cleanText(value);
  if (!text || isProductionValue(text)) return text;
  const invoiceMatch = text.match(/\bIV\d{4}-\d+\b/i);
  return invoiceMatch ? invoiceMatch[0].toUpperCase() : text;
}

function reconcileCostLinks() {
  let changed = false;
  state.costs.forEach((cost) => {
    if (cost.invoiceId || !cost.linkedInvoiceNo || isProductionValue(cost.linkedInvoiceNo)) return;
    const invoice = findInvoiceByNo(cost.linkedInvoiceNo);
    if (!invoice) return;
    cost.invoiceId = invoice.id;
    cost.linkedInvoiceNo = invoice.invoiceNo;
    cost.owner = "";
    changed = true;
  });
  if (changed) persist();
}

function renumberFacebookListings() {
  let changed = false;
  state.facebookListings.forEach((row, index) => {
    const nextNo = String(index + 1);
    if (row.no !== nextNo) {
      row.no = nextNo;
      changed = true;
    }
  });
  return changed;
}

function totals(invoices) {
  return invoices.reduce(
    (acc, invoice) => {
      acc.sales += Number(invoice.amount || 0);
      acc.cost += invoiceCostTotal(invoice.id);
      acc.profit += invoiceProfit(invoice);
      acc.agentOrder += Number(invoice.agentOrder || 0);
      acc.outstanding += Number(invoice.outstanding || 0);
      acc.count += 1;
      return acc;
    },
    { sales: 0, cost: 0, profit: 0, agentOrder: 0, outstanding: 0, count: 0 },
  );
}

function init() {
  reconcileCostLinks();
  reconcileFacebookStatuses();
  applyFacebookFollowUpDemoDate();
  reconcileFacebookDealStatuses();
  if (renumberFacebookListings()) persist();
  populateSalespeople();
  populateMissionPeople();
  populateFacebookPosts();
  populateInstallationTimeOptions();
  setDefaultMonth();
  bindEvents();
  ensureCostTypeFilterControls();
  refreshInvoiceOptions();
  setDefaultDates();
  // 初始加载时走 switchView,确保按钮显隐(New invoice / New Mission)等视图状态在首屏就正确应用。
  switchView(activeView);
}

function populateSalespeople() {
  const people = getSalespeople();
  const options = people.map((name) => `<option>${escapeHtml(name)}</option>`).join("");
  const selectedScorecardPerson = els.scorecardSalesperson?.value;
  const selectedFacebookPerson = els.facebookSalespersonFilter?.value;
  const selectedFacebookInputPerson = els.facebookSalespersonInput?.value;
  const selectedAgentPerson = els.agentSalespersonSelect?.value;
  els.salespersonFilter.innerHTML = `<option value="All">All salespeople</option>${options}`;
  els.importSalesperson.innerHTML = options;
  document.querySelector("#invoiceSalesperson").innerHTML = options;
  if (els.facebookSalespersonInput) {
    els.facebookSalespersonInput.innerHTML = options;
    els.facebookSalespersonInput.value = people.includes(selectedFacebookInputPerson) ? selectedFacebookInputPerson : people[0] || "";
  }
  if (els.facebookSalespersonFilter) {
    els.facebookSalespersonFilter.innerHTML = `<option value="All">All salespeople</option>${options}`;
    els.facebookSalespersonFilter.value = people.includes(selectedFacebookPerson) ? selectedFacebookPerson : "All";
  }
  if (els.facebookStatusFilter) {
    const selectedStatus = els.facebookStatusFilter.value;
    const filterStatuses = ["Follow Up", ...FACEBOOK_STATUSES];
    els.facebookStatusFilter.innerHTML = `<option value="All">All status</option>${filterStatuses.map((status) => `<option>${escapeHtml(status)}</option>`).join("")}`;
    els.facebookStatusFilter.value = filterStatuses.includes(selectedStatus) ? selectedStatus : "All";
  }
  if (els.facebookStatusInput) {
    const selectedInputStatus = els.facebookStatusInput.value;
    els.facebookStatusInput.innerHTML = FACEBOOK_STATUSES.map((status) => `<option>${escapeHtml(status)}</option>`).join("");
    els.facebookStatusInput.value = FACEBOOK_STATUSES.includes(selectedInputStatus) ? selectedInputStatus : FACEBOOK_STATUSES[0];
  }
  if (els.agentSalespersonSelect) {
    els.agentSalespersonSelect.innerHTML = options;
    els.agentSalespersonSelect.value = people.includes(selectedAgentPerson) ? selectedAgentPerson : people[0] || "";
  }
  if (els.scorecardSalesperson) {
    els.scorecardSalesperson.innerHTML = options;
    els.scorecardSalesperson.value = people.includes(selectedScorecardPerson) ? selectedScorecardPerson : people[0] || "";
  }
}

function populateInstallationTimeOptions() {
  [els.installationStartTime, els.installationEndTime].forEach((select) => {
    if (!select) return;
    const selected = select.value;
    const options = [`<option value="">--:-- --</option>`];
    for (let hour = 0; hour < 24; hour += 1) {
      [0, 30].forEach((minute) => {
        const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        const hour12 = hour % 12 || 12;
        const suffix = hour < 12 ? "AM" : "PM";
        const label = `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
        options.push(`<option value="${value}">${label}</option>`);
      });
    }
    select.innerHTML = options.join("");
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  });
}

function setDefaultMonth() {
  const dates = state.invoices.map((invoice) => invoice.date).filter(Boolean).sort();
  const fallback = todayInputValue();
  els.dateFromFilter.value = dates.at(-1) || fallback;
  els.dateToFilter.value = els.dateFromFilter.value;
  els.importMonth.value = selectedFilterMonth();
  if (els.scorecardMonth) els.scorecardMonth.value = selectedFilterMonth();
}

function setDefaultDates() {
  const today = todayInputValue();
  document.querySelector("#invoiceDate").value ||= today;
  document.querySelector("#costDate").value ||= today;
  if (els.facebookDate) els.facebookDate.value ||= today;
}

function bindManualInstallationForm() {
  const form = document.querySelector("#manualInstallationForm");
  const addBtn = document.querySelector("#addInstallationButton");
  if (!form || !addBtn) return;
  addBtn.addEventListener("click", () => {
    form.hidden = !form.hidden;
    if (!form.hidden) document.querySelector("#miDate")?.focus();
  });
  document.querySelector("#miCancel")?.addEventListener("click", () => {
    form.reset();
    form.hidden = true;
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const val = (sel) => (document.querySelector(sel)?.value || "").trim();
    state.installations = state.installations || [];
    state.installations.push({
      id: createId(),
      manual: true,
      invoiceNo: val("#miInvNo"),
      installerPhone: val("#miInstallerPhone"),
      customerPhone: val("#miCustomerPhone"),
      date: document.querySelector("#miDate")?.value || "",
      startTime: document.querySelector("#miStartTime")?.value || "",
      endTime: document.querySelector("#miEndTime")?.value || "",
      completed: false,
      completedAt: "",
      createdAt: todayInputValue(),
    });
    persist();
    form.reset();
    form.hidden = true;
    render();
  });
}

function bindEvents() {
  bindManualInstallationForm();
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  document.querySelectorAll("[data-view-jump]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.viewJump));
  });
  [els.dateFromFilter, els.dateToFilter, els.salespersonFilter, els.searchInput].forEach((control) => control.addEventListener("input", render));
  [els.scorecardSalesperson, els.scorecardMonth].forEach((control) => control?.addEventListener("input", render));
  [els.facebookSalespersonFilter, els.facebookStatusFilter].forEach((control) => control?.addEventListener("input", render));
  els.facebookListingInput?.addEventListener("change", importFacebookListingFile);
  els.addFacebookCustomerButton?.addEventListener("click", openFacebookListingForm);
  els.facebookPostManageButton?.addEventListener("click", openFacebookPostDialog);
  els.facebookPostDialogClose?.addEventListener("click", closeFacebookPostDialog);
  els.facebookPostAddConfirm?.addEventListener("click", addFacebookPost);
  els.facebookPostDeleteConfirm?.addEventListener("click", deleteFacebookPost);
  els.facebookForm?.addEventListener("submit", saveFacebookListing);
  els.clearFacebookButton?.addEventListener("click", clearFacebookListingForm);
  els.closeFacebookButton?.addEventListener("click", closeFacebookListingForm);
  els.addAgentButton?.addEventListener("click", addAgent);
  els.accountDetailForm?.addEventListener("submit", saveAccountDetail);
  els.facebookStatusCards?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-facebook-status-card]");
    if (!card || !els.facebookStatusFilter) return;
    els.facebookStatusFilter.value = card.dataset.facebookStatusCard || "All";
    render();
  });
  els.facebookBody?.addEventListener("change", (event) => {
    const select = event.target.closest("[data-facebook-status-select]");
    if (select) {
      updateFacebookListingStatus(select.dataset.facebookStatusSelect, select.value);
      return;
    }
    const field = event.target.closest("[data-facebook-field]");
    if (field) updateFacebookListingField(field.dataset.facebookRow, field.dataset.facebookField, field.value);
  });
  els.scorecardRateInput?.addEventListener("input", updateCommissionRate);
  els.scorecardMetrics?.addEventListener("click", openScorecardDetailFromEvent);
  els.scorecardMetrics?.addEventListener("keydown", openScorecardDetailFromEvent);
  els.scorecardDetailClose?.addEventListener("click", closeScorecardDetail);
  els.importType.addEventListener("change", updateUploadFields);
  document.querySelector("#addSalespersonButton").addEventListener("click", addSalesperson);
  document.querySelectorAll("[data-invoice-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.invoiceSort;
      invoiceLedgerSort = invoiceLedgerSort === key ? `${key}-desc` : key;
      render();
    });
  });
  document.querySelectorAll("[data-cost-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      costLedgerSort = costLedgerSort === "date" ? "date-desc" : "date";
      render();
    });
  });
  els.newSalespersonName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSalesperson();
    }
  });
  document.querySelector("#quickEntryButton").addEventListener("click", () => {
    showFullEntry();
    switchView("entry");
  });
  setupMissionCenter();
  document.querySelector("#openScorecardButton").addEventListener("click", () => switchView("scorecard"));
  document.querySelector("#backToDashboardButton").addEventListener("click", () => switchView("dashboard"));
  document.querySelector("#addInvoiceButton").addEventListener("click", () => {
    showFullEntry();
    clearInvoiceForm();
    switchView("entry");
  });
  document.querySelector("#addCostButtonTop").addEventListener("click", () => {
    showFullEntry();
    clearCostForm();
    switchView("entry");
    document.querySelector("#costDocNo").focus();
  });
  document.querySelector("#clearInvoiceButton").addEventListener("click", clearInvoiceForm);
  document.querySelector("#clearCostButton").addEventListener("click", clearCostForm);
  els.invoiceJobType?.addEventListener("change", updateInvoiceJobTypeFields);
  els.installationPostcode?.addEventListener("input", updateInstallationLocationFromPostcode);
  els.installationPostcode?.addEventListener("blur", updateInstallationLocationFromPostcode);
  els.installationCalendarMonthInput?.addEventListener("input", () => {
    installationCalendarMonth = els.installationCalendarMonthInput.value;
    renderInstallationPage();
  });
  els.installationCalendarPrev?.addEventListener("click", () => shiftInstallationCalendarMonth(-1));
  els.installationCalendarNext?.addEventListener("click", () => shiftInstallationCalendarMonth(1));
  // Jobs-list month filter (Add-New toolbar): pick a month to see just that
  // month's jobs and how many are completed vs pending; "All" clears it.
  els.installationJobsMonthInput?.addEventListener("input", () => {
    installationJobsMonth = els.installationJobsMonthInput.value;
    renderInstallationPage();
  });
  els.installationJobsMonthClear?.addEventListener("click", () => {
    installationJobsMonth = "";
    if (els.installationJobsMonthInput) els.installationJobsMonthInput.value = "";
    renderInstallationPage();
  });
  [els.installationStartTime, els.installationEndTime].forEach((input) => {
    input?.addEventListener("change", () => normalizeTimeInputToHalfHour(input));
    input?.addEventListener("blur", () => normalizeTimeInputToHalfHour(input));
  });
  document.querySelector("#exportCsvButton").addEventListener("click", exportCsv);
  document.querySelector("#exportJsonButton").addEventListener("click", exportJson);
  document.querySelector("#importJsonInput").addEventListener("change", importJson);
  document.querySelector("#pasteJsonButton").addEventListener("click", openPasteJsonDialog);
  els.jsonCopyButton?.addEventListener("click", copyJsonFromDialog);
  els.jsonRestoreButton?.addEventListener("click", restoreJsonFromDialog);
  els.jsonCloseButton?.addEventListener("click", closeJsonTransferDialog);
  els.brandLogo.addEventListener("click", () => switchView("dashboard"));
  document.querySelector("#pictureLogoUploadButton").addEventListener("click", () => {
    els.logoImageInput.value = "";
    els.logoImageInput.click();
  });
  document.querySelector("#openSalespersonSettingsButton")?.addEventListener("click", () => openSettingsDialog("salespersonSettingsDialog"));
  document.querySelector("#closeSalespersonSettingsButton")?.addEventListener("click", () => closeSettingsDialog("salespersonSettingsDialog"));
  document.querySelector("#openTrashSettingsButton")?.addEventListener("click", () => openSettingsDialog("trashSettingsDialog"));
  document.querySelector("#closeTrashSettingsButton")?.addEventListener("click", () => closeSettingsDialog("trashSettingsDialog"));
  document.querySelector("#openAgentSettingsButton")?.addEventListener("click", () => openSettingsDialog("agentSettingsDialog"));
  document.querySelector("#closeAgentSettingsButton")?.addEventListener("click", () => closeSettingsDialog("agentSettingsDialog"));
  document.querySelector("#openAccountSettingsButton")?.addEventListener("click", () => openSettingsDialog("accountSettingsDialog"));
  document.querySelector("#closeAccountSettingsButton")?.addEventListener("click", () => closeSettingsDialog("accountSettingsDialog"));
  document.querySelector("#openPictureSettingsButton")?.addEventListener("click", openPictureSettings);
  document.querySelector("#closePictureSettingsButton")?.addEventListener("click", closePictureSettings);
  els.logoImageInput.addEventListener("change", (event) => importImageSetting(event, "logoImage"));
  els.salesPersonImageInput.addEventListener("change", importSalesPersonImage);
  document.querySelectorAll(".avatar-upload-button").forEach((button) => {
    button.addEventListener("click", () => {
      editingAvatarTier = button.dataset.avatarTier;
      els.avatarTierImageInput.value = "";
      els.avatarTierImageInput.click();
    });
  });
  els.avatarTierImageInput.addEventListener("change", importAvatarTierImage);
  els.invoiceReportInput.addEventListener("change", importInvoiceReport);
  document.querySelector("#selectAllInvoicesButton").addEventListener("click", selectAllVisibleInvoices);
  document.querySelector("#cancelInvoiceSelectionButton").addEventListener("click", cancelInvoiceSelection);
  document.querySelector("#trashSelectedInvoicesButton").addEventListener("click", moveSelectedInvoicesToTrash);
  document.querySelector("#selectAllCostsButton").addEventListener("click", selectAllVisibleCosts);
  document.querySelector("#cancelCostSelectionButton").addEventListener("click", cancelCostSelection);
  document.querySelector("#trashSelectedCostsButton").addEventListener("click", moveSelectedCostsToTrash);
  document.querySelector("#restoreTrashButton").addEventListener("click", restoreSelectedTrashMonth);
  document.querySelector("#deleteTrashButton").addEventListener("click", deleteSelectedTrashMonthForever);
  document.querySelector("#resetButton").addEventListener("click", resetData);
  els.invoiceForm.addEventListener("submit", saveInvoice);
  els.costForm.addEventListener("submit", saveCost);
  els.salesPersonEditPanel.addEventListener("submit", saveSalespersonEdit);
  document.querySelector("#cancelSalespersonEditButton").addEventListener("click", cancelSalespersonEdit);
  els.editingSalespersonImage.addEventListener("change", previewSalespersonEditImage);
  els.linkedInvoice.addEventListener("change", renderLinkedPreview);
  bindInstallationMapEvents();
  els.salespersonManagerBody.addEventListener("click", (event) => {
    const editButton = event.target.closest(".edit-salesperson-button");
    if (editButton) {
      editSalesperson(editButton.dataset.name);
      return;
    }
    const deleteButton = event.target.closest(".delete-salesperson-button");
    if (deleteButton) deleteSalesperson(deleteButton.dataset.name);
  });
}

function switchView(view) {
  activeView = view;
  // "+ New invoice / cost" 按钮只在 Invoices / Costs 页面显示;"+ New Mission" 只在 Mission 页面显示。
  const quickEntryBtn = document.querySelector("#quickEntryButton");
  if (quickEntryBtn) quickEntryBtn.style.display = (view === "invoices" || view === "costs") ? "" : "none";
  const newMissionBtn = document.querySelector("#newMissionButton");
  if (newMissionBtn) newMissionBtn.style.display = (view === "mission") ? "" : "none";
  if (view !== "entry") showFullEntry();
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  document.querySelector(`#${view}View`).classList.add("active");
  document.querySelectorAll(".nav-tab").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  els.viewTitle.textContent =
    view === "dashboard"
      ? "Dashboard"
      : view === "invoices"
        ? "Invoices"
        : view === "costs"
          ? "Costs"
          : view === "installation"
            ? "Installation"
            : view === "trash"
              ? "Trash"
              : view === "salespeople"
                ? "Sales Person"
                : view === "settings"
                  ? "Settings"
                  : view === "scorecard"
                    ? "Sales Scorecard"
                    : view === "mission"
                      ? "Mission"
                      : view === "facebook"
                        ? "Facebook Listing"
                        : "Entry";
  render();
}

function setupMissionCenter() {
  // 子标签:按任务类型筛选下方表格
  const tabs = document.querySelector("#missionSubtabs");
  if (tabs) {
    tabs.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-mission-tab]");
      if (!btn) return;
      tabs.querySelectorAll(".mission-subtab").forEach((b) => b.classList.toggle("active", b === btn));
      const type = btn.dataset.missionTab;
      document.querySelectorAll("#missionView .mission-table tbody tr").forEach((row) => {
        row.style.display = type === "all" || row.dataset.missionRow === type ? "" : "none";
      });
    });
  }
  document.querySelector("#newMissionButton")?.addEventListener("click", () => {
    alert("New Mission — coming soon!");
  });
  // 销售员下拉:一个一个看,切换时重新渲染。
  document.querySelector("#missionPersonSelect")?.addEventListener("change", render);
  // Challenge Ends In:真实倒计时,每秒更新。
  updateMissionCountdown();
  setInterval(updateMissionCountdown, 1000);
}

// 6 个月挑战结束日(可改);倒计时倒数到这一天。
const MISSION_CHALLENGE_END = "2026-10-31T23:59:59";

function updateMissionCountdown() {
  if (!document.querySelector("#missionClockDays")) return;
  let diff = Math.max(0, new Date(MISSION_CHALLENGE_END).getTime() - Date.now());
  const days = Math.floor(diff / 86400000); diff -= days * 86400000;
  const hours = Math.floor(diff / 3600000); diff -= hours * 3600000;
  const mins = Math.floor(diff / 60000); diff -= mins * 60000;
  const secs = Math.floor(diff / 1000);
  setMissionText("missionClockDays", String(days));
  setMissionText("missionClockHours", String(hours).padStart(2, "0"));
  setMissionText("missionClockMins", String(mins).padStart(2, "0"));
  setMissionText("missionClockSecs", String(secs).padStart(2, "0"));
}

// ---- Mission Center 动态数据(跟随日期筛选 + 单个销售员) ----
const MISSION_PERSON_TARGET = 600000;
const MISSION_TEAM_COMPANY_TARGET = 1500600;
const MISSION_MONTHLY_TARGET = 100000;
const MISSION_TEAM_TARGET = 500000;
const MISSION_AGENT_TARGET = 50000;
const MISSION_REWARDS = { monthly: 1000, team: 2000, agent: 500, pk: 15000 };

// 里程碑配置(value=目标销售额, pct=显示百分比, reward=奖励)
const MISSION_MONTH_MILESTONES = [
  { value: 10000, pct: "10%", reward: "RM 500" },
  { value: 30000, pct: "30%", reward: "RM 1,500" },
  { value: 80000, pct: "80%", reward: "RM 3,000" },
  { value: 100000, pct: "100%", reward: "RM 6,000" },
  { value: 200000, pct: "200%", reward: "RM 10,000" },
];
const MISSION_YEAR_MILESTONES = [
  { value: 500000, pct: "50%", reward: "RM 5,000" },
  { value: 600000, pct: "60%", reward: "RM 8,000" },
  { value: 800000, pct: "80%", reward: "RM 12,000" },
  { value: 1000000, pct: "100%", reward: "RM 20,000" },
  { value: 1500000, pct: "150%", reward: "RM 35,000" },
];

function missionMoney(value) {
  return currency.format(value).replace(/\.00$/, "");
}

function renderMilestones(containerId, footerId, sales, milestones) {
  const container = document.querySelector(`#${containerId}`);
  if (!container) return;
  const nextIdx = milestones.findIndex((m) => sales < m.value);
  container.innerHTML = milestones
    .map((m, i) => {
      const state = sales >= m.value ? "done" : i === nextIdx ? "next" : "locked";
      const icon = state === "done" ? "✔" : state === "next" ? "🎁" : "🔒";
      return `<div class="mission-milestone ${state}"><i class="mission-node">${icon}</i><strong>${missionMoney(m.value)}</strong><span>${m.pct}</span><em class="mission-green">${escapeHtml(m.reward)}</em></div>`;
    })
    .join("");
  const footer = document.querySelector(`#${footerId}`);
  if (!footer) return;
  if (nextIdx === -1) {
    footer.innerHTML = `<div><span>All Milestones</span><strong class="mission-cyan">Completed 🎉</strong></div>`;
  } else {
    const next = milestones[nextIdx];
    const needMore = Math.max(0, next.value - sales);
    footer.innerHTML =
      `<div><span>Next Milestone</span><strong class="mission-cyan">${missionMoney(next.value)} (${next.pct})</strong></div>` +
      `<div><span>Need More</span><strong>${currency.format(needMore)}</strong></div>` +
      `<div><span>Expected Bonus</span><strong>${escapeHtml(next.reward)}</strong></div>`;
  }
}

function populateMissionPeople() {
  const sel = document.querySelector("#missionPersonSelect");
  if (!sel) return;
  const people = getSalespeople();
  const current = sel.value;
  sel.innerHTML = people.map((name) => `<option>${escapeHtml(name)}</option>`).join("");
  if (people.includes(current)) sel.value = current;
}

function getMissionPerson() {
  const sel = document.querySelector("#missionPersonSelect");
  const people = getSalespeople();
  if (!people.length) return "";
  let person = sel?.value;
  if (!person || !people.includes(person)) {
    const globalPerson = els.salespersonFilter?.value;
    person = globalPerson && globalPerson !== "All" && people.includes(globalPerson) ? globalPerson : people[0];
  }
  if (sel && sel.value !== person) sel.value = person;
  return person;
}

function setMissionBar(id, pct) {
  const el = document.querySelector(`#${id}`);
  if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function setMissionText(id, text) {
  const el = document.querySelector(`#${id}`);
  if (el) el.textContent = text;
}

function setMissionStatus(id, pct, locked = false) {
  const el = document.querySelector(`#${id}`);
  if (!el) return;
  if (locked) {
    el.textContent = "Locked";
    el.className = "mission-status locked";
  } else if (pct >= 100) {
    el.textContent = "Completed";
    el.className = "mission-status done";
  } else {
    el.textContent = "In Progress";
    el.className = "mission-status progress";
  }
}

function renderMission() {
  if (!document.querySelector("#missionView")) return;
  const filters = getFilters();
  const dateInvoices = state.invoices.filter((inv) => !inv.trashedAt && matchesDateRange(inv.date, filters));
  const people = getSalespeople();
  const person = getMissionPerson();
  const personInvoices = dateInvoices.filter((inv) => inv.salesperson === person);
  const personSales = personInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
  const personAgent = personInvoices.reduce((sum, inv) => sum + Number(inv.agentOrder || 0), 0);
  const teamSales = dateInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  // 顶部日期范围(跟随 Filters 的 From / To）
  const range = filters.dateFrom && filters.dateTo
    ? `📅 ${filters.dateFrom} → ${filters.dateTo}`
    : "📅 All dates";
  setMissionText("missionPeriodPill", range);

  // My Overall Progress
  setMissionText("missionPersonName", (person || "—").toUpperCase());
  setMissionText("missionPersonSales", currency.format(personSales));
  setMissionText("missionPersonTargetLabel", `vs Company Target ${currency.format(MISSION_PERSON_TARGET)}`);
  const personPct = MISSION_PERSON_TARGET ? (personSales / MISSION_PERSON_TARGET) * 100 : 0;
  setMissionBar("missionPersonBar", personPct);
  setMissionText("missionPersonPct", `${personPct.toFixed(1)}%`);

  // Ranking(按本期销售排名)
  const ranked = people
    .map((name) => ({ name, sales: dateInvoices.filter((inv) => inv.salesperson === name).reduce((sum, inv) => sum + Number(inv.amount || 0), 0) }))
    .sort((a, b) => b.sales - a.sales);
  const rank = ranked.findIndex((r) => r.name === person) + 1;
  setMissionText("missionStatRanking", `${rank || "-"} / ${people.length}`);

  // Missions Completed + Total Rewards
  const completed = {
    monthly: personSales >= MISSION_MONTHLY_TARGET,
    team: teamSales >= MISSION_TEAM_TARGET,
    agent: personAgent >= MISSION_AGENT_TARGET,
    pk: teamSales >= MISSION_TEAM_COMPANY_TARGET,
  };
  const completedCount = Object.values(completed).filter(Boolean).length;
  setMissionText("missionStatCompleted", `${completedCount} / 6`);
  let rewards = 0;
  if (completed.monthly) rewards += MISSION_REWARDS.monthly;
  if (completed.team) rewards += MISSION_REWARDS.team;
  if (completed.agent) rewards += MISSION_REWARDS.agent;
  if (completed.pk) rewards += MISSION_REWARDS.pk;
  setMissionText("missionStatRewards", currency.format(rewards));

  // PK Challenge(团队总销售）
  setMissionText("missionTeamSales", currency.format(teamSales));
  const teamPct = MISSION_TEAM_COMPANY_TARGET ? (teamSales / MISSION_TEAM_COMPANY_TARGET) * 100 : 0;
  setMissionBar("missionTeamBar", teamPct);
  setMissionText("missionTeamPct", `${teamPct.toFixed(0)}%`);

  // 任务表格行
  const monthlyPct = (personSales / MISSION_MONTHLY_TARGET) * 100;
  setMissionBar("missionRowMonthlyBar", monthlyPct);
  setMissionText("missionRowMonthlyText", `${currency.format(personSales)} · ${monthlyPct.toFixed(0)}%`);
  setMissionStatus("missionRowMonthlyStatus", monthlyPct);

  const teamRowPct = (teamSales / MISSION_TEAM_TARGET) * 100;
  setMissionBar("missionRowTeamBar", teamRowPct);
  setMissionText("missionRowTeamText", `${currency.format(teamSales)} · ${teamRowPct.toFixed(0)}%`);
  setMissionStatus("missionRowTeamStatus", teamRowPct);

  const agentPct = (personAgent / MISSION_AGENT_TARGET) * 100;
  setMissionBar("missionRowAgentBar", agentPct);
  setMissionText("missionRowAgentText", `${currency.format(personAgent)} · ${agentPct.toFixed(0)}%`);
  setMissionStatus("missionRowAgentStatus", agentPct);

  const pkRowPct = (teamSales / MISSION_TEAM_COMPANY_TARGET) * 100;
  setMissionBar("missionRowPkBar", pkRowPct);
  setMissionText("missionRowPkText", `${currency.format(teamSales)} · ${pkRowPct.toFixed(0)}%`);
  setMissionStatus("missionRowPkStatus", pkRowPct);

  // Agent Order Summary(本期 agent 销售)
  setMissionText("missionAgentPeriodSales", currency.format(personAgent));

  // 里程碑(跟随所选销售员本期销售额,达到即点亮)
  renderMilestones("missionMonthMilestones", "missionMonthNext", personSales, MISSION_MONTH_MILESTONES);
  renderMilestones("missionYearMilestones", "missionYearNext", personSales, MISSION_YEAR_MILESTONES);
}

function showInvoiceOnlyEntry() {
  document.querySelector("#entryView").classList.add("invoice-only-entry");
  document.querySelector("#entryView").classList.remove("cost-only-entry");
}

function showCostOnlyEntry() {
  document.querySelector("#entryView").classList.add("cost-only-entry");
  document.querySelector("#entryView").classList.remove("invoice-only-entry");
}

function showFullEntry() {
  document.querySelector("#entryView").classList.remove("invoice-only-entry");
  document.querySelector("#entryView").classList.remove("cost-only-entry");
}

function ensureCostTypeFilterControls() {
  const toolbar = document.querySelector("#costsView .records-toolbar");
  if (!toolbar || toolbar.querySelector(".cost-type-filter")) return;
  const filter = document.createElement("div");
  filter.className = "cost-type-filter";
  filter.setAttribute("aria-label", "Cost type filter");
  filter.innerHTML = ["All", ...COST_TYPES].map((type) => `
    <button class="cost-type-filter-button" type="button" data-cost-type="${escapeHtml(type)}">
      <span class="cost-type-filter-label">${escapeHtml(type)}</span>
      <span class="cost-type-filter-count">0</span>
    </button>
  `).join("");
  filter.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cost-type]");
    if (!button) return;
    costTypeFilter = button.dataset.costType || "All";
    render();
  });
  const actions = toolbar.querySelector(".toolbar-actions");
  toolbar.insertBefore(filter, actions || null);
}

function filterCostsBySelectedType(costs) {
  if (costTypeFilter === "All") return costs;
  return costs.filter((cost) => cost.type === costTypeFilter);
}

function render() {
  const invoices = getFilteredInvoices();
  const costs = getFilteredCosts();
  const costLedgerCosts = filterCostsBySelectedType(costs);
  const facebookRows = getFilteredFacebookListings();
  const trashInvoices = getFilteredTrashInvoices();
  const trashCosts = getFilteredTrashCosts();
  ensureCostTypeFilterControls();
  renderBranding();
  updateUploadFields();
  renderKpis(invoices, costs);
  renderSalespeople(invoices);
  renderTargetChart();
  renderUntickedInvoices(invoices);
  renderSalesScorecard();
  renderMission();
  renderTrend();
  renderLatestInvoices(costs);
  renderInvoiceTable(invoices);
  renderCostTable(costLedgerCosts);
  renderInstallationPage();
  renderCostTypeFilterCounts(costs);
  renderFacebookListing(facebookRows);
  renderTrashTable(trashInvoices, trashCosts);
  renderSalespersonManager();
  renderSettings();
  renderEmptyStates(invoices, costs, trashInvoices, trashCosts, facebookRows);
  renderSelectionMode();
  refreshInvoiceOptions();
  renderLinkedPreview();
}

function renderCostTypeFilterCounts(costs) {
  const counts = {
    All: costs.length,
    ...Object.fromEntries(COST_TYPES.map((type) => [type, costs.filter((cost) => cost.type === type).length])),
  };
  document.querySelectorAll(".cost-type-filter-button").forEach((button) => {
    const type = button.dataset.costType || "All";
    const count = counts[type] || 0;
    const countEl = button.querySelector(".cost-type-filter-count");
    if (countEl) countEl.textContent = String(count);
    button.setAttribute("aria-label", `${type}: ${count} cost bills`);
    button.title = `${type}: ${count} cost bills`;
  });
}

function installationInvoices() {
  return state.invoices
    .filter((invoice) => !invoice.trashedAt && invoice.jobType === "installation")
    .sort((a, b) => {
      const aDate = a.installation?.date || a.date || "";
      const bDate = b.installation?.date || b.date || "";
      return aDate.localeCompare(bDate) || String(a.invoiceNo || "").localeCompare(String(b.invoiceNo || ""), undefined, { numeric: true });
    });
}

// Manually-added installations, shaped like an installation invoice so they
// render in the jobs list + calendar alongside invoice-derived jobs.
function manualInstallationJobs() {
  return (state.installations || []).map((it) => ({
    id: it.id,
    manual: true,
    invoiceNo: it.invoiceNo || "(no inv)",
    customer: "",
    installerPhone: it.installerPhone || "",
    customerPhone: it.customerPhone || "",
    jobType: "installation",
    installation: {
      date: it.date || "",
      startTime: it.startTime || "",
      endTime: it.endTime || "",
      completed: it.completed,
      address: "",
      postcode: "",
      state: "",
    },
  }));
}

function renderInstallationPage() {
  if (!els.installationJobs) return;
  const invoiceJobs = installationInvoices();
  const jobs = invoiceJobs
    .concat(manualInstallationJobs())
    .sort((a, b) => (a.installation?.date || "").localeCompare(b.installation?.date || ""));
  const completed = jobs.filter((invoice) => invoice.installation?.completed).length;
  const pending = jobs.length - completed;
  if (els.installationSummary) {
    els.installationSummary.textContent = `${jobs.length} installation jobs · ${pending} pending · ${completed} completed`;
  }
  // Month filter for the jobs LIST only (from the Add-New toolbar). The map and
  // calendar below keep showing all jobs.
  const listJobs = installationJobsMonth
    ? jobs.filter((invoice) => (invoice.installation?.date || "").slice(0, 7) === installationJobsMonth)
    : jobs;
  const listCompleted = listJobs.filter((invoice) => invoice.installation?.completed).length;
  const listPending = listJobs.length - listCompleted;
  if (els.installationJobsMonthInput && els.installationJobsMonthInput.value !== installationJobsMonth) {
    els.installationJobsMonthInput.value = installationJobsMonth;
  }
  if (els.installationJobsMonthNote) {
    if (installationJobsMonth) {
      const label = new Date(`${installationJobsMonth}-01T00:00:00`).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
      els.installationJobsMonthNote.innerHTML = `${label}: ${listJobs.length} job${listJobs.length === 1 ? "" : "s"} · <b class="done">${listCompleted} completed</b> · <b class="pend">${listPending} pending</b>`;
      els.installationJobsMonthNote.hidden = false;
    } else {
      els.installationJobsMonthNote.hidden = true;
    }
  }
  if (els.installationJobCount) els.installationJobCount.textContent = `${listPending} pending`;
  if (els.installationEmpty) els.installationEmpty.classList.toggle("active", !listJobs.length);
  els.installationJobs.innerHTML = listJobs.map((invoice) => {
    const install = invoice.installation || {};
    const detail = invoice.manual
      ? `${invoice.installerPhone ? `<small class="installation-job-contact">Installer: ${escapeHtml(invoice.installerPhone)}</small>` : ""}${invoice.customerPhone ? `<small class="installation-job-contact">Customer: ${escapeHtml(invoice.customerPhone)}</small>` : ""}`
      : `<small>${escapeHtml(installationAddressLine(install))}</small>`;
    const remove = invoice.manual
      ? `<button type="button" class="danger-ghost installation-job-delete" title="Delete installation" onclick="deleteManualInstallation('${invoice.id}')">✕</button>`
      : "";
    return `
      <article class="installation-job ${install.completed ? "completed" : ""}">
        <div class="installation-job-main">
          <span class="lorry-icon" aria-hidden="true">🚚</span>
          <div>
            <h4>${escapeHtml(invoice.invoiceNo)}</h4>
            <p>${escapeHtml(invoice.customer || "Installation job")}</p>
            ${detail}
          </div>
        </div>
        <div class="installation-job-time">
          <strong>${escapeHtml(formatInstallationDate(install.date))}</strong>
          <span>${escapeHtml(formatInstallationTime(install.startTime, install.endTime))}</span>
        </div>
        <label class="status-check installation-check" title="Installation completed">
          <input type="checkbox" ${install.completed ? "checked" : ""} onchange="toggleInstallationComplete('${invoice.id}', this.checked)" />
          <span>&#10003;</span>
        </label>
        ${remove}
      </article>
    `;
  }).join("");
  renderInstallationMap(invoiceJobs);
  renderInstallationCalendar(jobs);
}

function renderInstallationCalendar(jobs = installationInvoices()) {
  if (!els.installationCalendar) return;
  const monthValue = installationCalendarMonth || firstInstallationMonth(jobs) || els.importMonth?.value || selectedFilterMonth() || todayInputValue().slice(0, 7);
  installationCalendarMonth = monthValue;
  if (els.installationCalendarMonthInput) els.installationCalendarMonthInput.value = monthValue;
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return;
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = firstDay.getDay();
  const monthJobs = jobs.filter((invoice) => (invoice.installation?.date || "").startsWith(monthValue));
  const jobsByDay = new Map();
  monthJobs.forEach((invoice) => {
    const day = Number((invoice.installation?.date || "").slice(8, 10));
    if (!day) return;
    if (!jobsByDay.has(day)) jobsByDay.set(day, []);
    jobsByDay.get(day).push(invoice);
  });
  if (els.installationCalendarMonth) {
    els.installationCalendarMonth.textContent = `${firstDay.toLocaleDateString("en-MY", { month: "long", year: "numeric" })} · ${monthJobs.length} job${monthJobs.length === 1 ? "" : "s"}`;
  }
  const cells = [];
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  for (let index = 0; index < totalCells; index += 1) {
    const day = index - startOffset + 1;
    if (day < 1 || day > daysInMonth) {
      cells.push(`<div class="installation-calendar-day muted"></div>`);
      continue;
    }
    const dayJobs = jobsByDay.get(day) || [];
    const dateValue = `${monthValue}-${String(day).padStart(2, "0")}`;
    const dayTag = dayJobs.length ? "button" : "div";
    const dayAttrs = dayJobs.length ? ` type="button" onclick="openInstallationDayJobs('${dateValue}')"` : "";
    cells.push(`
      <${dayTag} class="installation-calendar-day ${dayJobs.length ? "has-job" : ""}"${dayAttrs}>
        <div class="calendar-day-number">
          <span>${day}</span>
          ${dayJobs.length ? `<strong>${dayJobs.length} job${dayJobs.length > 1 ? "s" : ""}</strong>` : ""}
        </div>
        <div class="calendar-events">
          ${dayJobs.map((invoice) => {
            const install = invoice.installation || {};
            return `
              <article class="calendar-event ${install.completed ? "completed" : ""}" title="${escapeHtml(invoice.invoiceNo)} - ${escapeHtml(installationAddressLine(install))}">
                <span class="calendar-lorry-icon" aria-hidden="true">🚚</span>
                <strong>${escapeHtml(formatInstallationTime(install.startTime, install.endTime))}</strong>
                <small>${escapeHtml(invoice.customer || "Installation")}</small>
              </article>
            `;
          }).join("")}
        </div>
      </${dayTag}>
    `);
  }
  els.installationCalendar.innerHTML = `
    <div class="installation-calendar-weekdays">
      ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => `<span>${dayName}</span>`).join("")}
    </div>
    <div class="installation-calendar-grid">${cells.join("")}</div>
  `;
}

function firstInstallationMonth(jobs = installationInvoices()) {
  const datedJob = jobs.find((invoice) => invoice.installation?.date);
  return datedJob?.installation?.date?.slice(0, 7) || "";
}

function shiftInstallationCalendarMonth(delta) {
  const monthValue = installationCalendarMonth || els.installationCalendarMonthInput?.value || firstInstallationMonth() || selectedFilterMonth();
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return;
  const next = new Date(year, month - 1 + delta, 1);
  installationCalendarMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  renderInstallationPage();
}

window.openInstallationDayJobs = function openInstallationDayJobs(date) {
  if (!els.scorecardDetailDialog) return;
  const jobs = installationInvoices().filter((invoice) => invoice.installation?.date === date);
  const prettyDate = formatInstallationDate(date);
  els.scorecardDetailTitle.textContent = `Installation Jobs - ${prettyDate}`;
  els.scorecardDetailSummary.textContent = jobs.length
    ? `${jobs.length} job${jobs.length > 1 ? "s" : ""} scheduled for ${prettyDate}`
    : `No installation jobs scheduled for ${prettyDate}`;
  els.scorecardDetailBody.innerHTML = jobs.length
    ? `<div class="installation-day-detail-list">
        ${jobs.map((invoice) => {
          const install = invoice.installation || {};
          return `
            <article class="installation-day-detail ${install.completed ? "completed" : ""}">
              <div>
                <h4>${escapeHtml(invoice.invoiceNo)}</h4>
                <p>${escapeHtml(invoice.customer || "Installation job")}</p>
                <small>${escapeHtml(installationAddressLine(install))}</small>
              </div>
              <div class="installation-job-time">
                <strong>${escapeHtml(formatInstallationTime(install.startTime, install.endTime))}</strong>
                <span>${install.completed ? "Completed" : "Pending"}</span>
              </div>
            </article>
          `;
        }).join("")}
      </div>`
    : `<div class="empty-state active"><h3>No jobs</h3><p>No installation jobs scheduled for this date.</p></div>`;
  openScorecardDetailDialog();
};

function installationAddressLine(install = {}) {
  const parts = [
    install.address,
    install.postcode,
    install.state,
  ].map(cleanText).filter(Boolean);
  return parts.length ? parts.join(", ") : "No address yet";
}

function installationMapPoint(invoice, index, mapRect) {
  const coords = installationGeoPoint(invoice, index);
  const center = latLngToPixel(installationMapState.lat, installationMapState.lng, installationMapState.zoom);
  const point = latLngToPixel(coords.lat, coords.lng, installationMapState.zoom);
  const stagger = index ? 16 : 0;
  const angle = ((index % 12) / 12) * Math.PI * 2;
  return {
    x: mapRect.width / 2 + point.x - center.x + Math.cos(angle) * stagger,
    y: mapRect.height / 2 + point.y - center.y + Math.sin(angle) * stagger,
  };
}

function installationGeoPoint(invoice, index) {
  const address = `${invoice.installation?.address || ""} ${invoice.installation?.postcode || ""} ${invoice.installation?.state || ""} ${invoice.customer || ""}`.toLowerCase();
  const known = [
    { keys: ["johor", "jb", "johor bahru"], lat: 1.4927, lng: 103.7414 },
    { keys: ["kl", "kuala lumpur", "selangor", "shah alam", "petaling", "puchong", "kajang"], lat: 3.139, lng: 101.6869 },
    { keys: ["penang", "pulau pinang", "georgetown"], lat: 5.4164, lng: 100.3327 },
    { keys: ["perak", "ipoh"], lat: 4.5975, lng: 101.0901 },
    { keys: ["melaka", "malacca"], lat: 2.1896, lng: 102.2501 },
    { keys: ["negeri", "seremban"], lat: 2.7258, lng: 101.9424 },
    { keys: ["pahang", "kuantan"], lat: 3.8077, lng: 103.326 },
    { keys: ["terengganu", "kuala terengganu"], lat: 5.3296, lng: 103.137 },
    { keys: ["kelantan", "kota bharu"], lat: 6.1254, lng: 102.2381 },
    { keys: ["kedah", "alor setar"], lat: 6.1248, lng: 100.3678 },
    { keys: ["perlis", "kangar"], lat: 6.4414, lng: 100.1986 },
    { keys: ["sabah", "kota kinabalu"], lat: 5.9804, lng: 116.0735 },
    { keys: ["sarawak", "kuching"], lat: 1.5533, lng: 110.3592 },
  ];
  const matched = known.find((item) => item.keys.some((key) => address.includes(key)));
  if (matched) return { lat: matched.lat, lng: matched.lng };
  const text = `${invoice.invoiceNo} ${invoice.customer || ""} ${invoice.installation?.address || ""}`;
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  const points = [
    { lat: 3.139, lng: 101.6869 }, { lat: 1.4927, lng: 103.7414 }, { lat: 5.4164, lng: 100.3327 },
    { lat: 4.5975, lng: 101.0901 }, { lat: 2.1896, lng: 102.2501 }, { lat: 5.9804, lng: 116.0735 },
    { lat: 1.5533, lng: 110.3592 }, { lat: 3.8077, lng: 103.326 },
  ];
  return points[(hash + index) % points.length];
}

function clampInstallationMapPoint(point) {
  return {
    lat: Math.max(-6, Math.min(9, point.lat)),
    lng: Math.max(94, Math.min(121, point.lng)),
  };
}

function fitInstallationMapToJobs(jobs, mapRect) {
  const points = jobs.map((invoice, index) => installationGeoPoint(invoice, index));
  if (!points.length) {
    installationMapState = { lat: 4.2, lng: 109.5, zoom: 6 };
    return;
  }
  if (points.length === 1) {
    const center = clampInstallationMapPoint(points[0]);
    installationMapState = { ...center, zoom: 8 };
    return;
  }

  const padding = Math.min(96, Math.max(48, mapRect.width * 0.12));
  const availableWidth = Math.max(160, mapRect.width - padding * 2);
  const availableHeight = Math.max(160, mapRect.height - padding * 2);
  let bestZoom = 5;

  for (let zoom = 8; zoom >= 5; zoom -= 1) {
    const pixels = points.map((point) => latLngToPixel(point.lat, point.lng, zoom));
    const minX = Math.min(...pixels.map((point) => point.x));
    const maxX = Math.max(...pixels.map((point) => point.x));
    const minY = Math.min(...pixels.map((point) => point.y));
    const maxY = Math.max(...pixels.map((point) => point.y));
    if (maxX - minX <= availableWidth && maxY - minY <= availableHeight) {
      bestZoom = zoom;
      break;
    }
  }

  const pixels = points.map((point) => latLngToPixel(point.lat, point.lng, bestZoom));
  const centerPixel = {
    x: (Math.min(...pixels.map((point) => point.x)) + Math.max(...pixels.map((point) => point.x))) / 2,
    y: (Math.min(...pixels.map((point) => point.y)) + Math.max(...pixels.map((point) => point.y))) / 2,
  };
  const center = clampInstallationMapPoint(pixelToLatLng(centerPixel.x, centerPixel.y, bestZoom));
  installationMapState = { ...center, zoom: bestZoom };
}

function renderInstallationMap(jobs = installationInvoices()) {
  if (!els.installationMap || !els.installationMapTiles || !els.installationMapMarkers) return;
  const rect = els.installationMap.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  if (!installationMapUserAdjusted) fitInstallationMapToJobs(jobs, rect);
  const zoom = installationMapState.zoom;
  const tileSize = 256;
  const center = latLngToPixel(installationMapState.lat, installationMapState.lng, zoom);
  const startX = Math.floor((center.x - rect.width / 2) / tileSize);
  const endX = Math.floor((center.x + rect.width / 2) / tileSize);
  const startY = Math.floor((center.y - rect.height / 2) / tileSize);
  const endY = Math.floor((center.y + rect.height / 2) / tileSize);
  const maxTile = 2 ** zoom;
  const tiles = [];
  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      if (y < 0 || y >= maxTile) continue;
      const wrappedX = ((x % maxTile) + maxTile) % maxTile;
      const left = x * tileSize - center.x + rect.width / 2;
      const top = y * tileSize - center.y + rect.height / 2;
      tiles.push(`<img class="osm-map-tile" src="https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png" alt="" style="left:${left}px; top:${top}px;" loading="lazy" />`);
    }
  }
  els.installationMapTiles.innerHTML = tiles.join("");
  els.installationMapMarkers.innerHTML = jobs.map((invoice, index) => {
    const point = installationMapPoint(invoice, index, rect);
    const install = invoice.installation || {};
    return `
      <button class="installation-map-marker ${install.completed ? "completed" : ""}" type="button" style="left:${point.x}px; top:${point.y}px;" title="${escapeHtml(invoice.invoiceNo)} - ${escapeHtml(installationAddressLine(install))}">
        <span aria-hidden="true">🚚</span>
      </button>
    `;
  }).join("");
}

function latLngToPixel(lat, lng, zoom) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function pixelToLatLng(x, y, zoom) {
  const scale = 256 * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function setInstallationMapZoom(nextZoom) {
  installationMapUserAdjusted = true;
  installationMapState.zoom = Math.max(5, Math.min(13, nextZoom));
  renderInstallationMap();
}

function resetInstallationMap() {
  installationMapUserAdjusted = false;
  renderInstallationMap();
}

function bindInstallationMapEvents() {
  if (!els.installationMap) return;
  els.installationMapZoomIn?.addEventListener("click", () => setInstallationMapZoom(installationMapState.zoom + 1));
  els.installationMapZoomOut?.addEventListener("click", () => setInstallationMapZoom(installationMapState.zoom - 1));
  els.installationMapReset?.addEventListener("click", resetInstallationMap);
  els.installationMap.addEventListener("wheel", (event) => {
    event.preventDefault();
    setInstallationMapZoom(installationMapState.zoom + (event.deltaY < 0 ? 1 : -1));
  }, { passive: false });
  els.installationMap.addEventListener("pointerdown", (event) => {
    els.installationMap.setPointerCapture(event.pointerId);
    installationMapDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      center: latLngToPixel(installationMapState.lat, installationMapState.lng, installationMapState.zoom),
    };
  });
  els.installationMap.addEventListener("pointermove", (event) => {
    if (!installationMapDrag || installationMapDrag.pointerId !== event.pointerId) return;
    installationMapUserAdjusted = true;
    const nextCenter = {
      x: installationMapDrag.center.x - (event.clientX - installationMapDrag.startX),
      y: installationMapDrag.center.y - (event.clientY - installationMapDrag.startY),
    };
    const next = pixelToLatLng(nextCenter.x, nextCenter.y, installationMapState.zoom);
    const clamped = clampInstallationMapPoint(next);
    installationMapState.lat = clamped.lat;
    installationMapState.lng = clamped.lng;
    renderInstallationMap();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
    els.installationMap.addEventListener(type, () => {
      installationMapDrag = null;
    });
  });
}
function formatInstallationDate(date) {
  if (!date) return "Date not set";
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : date;
}

function formatInstallationTime(start, end) {
  if (start && end) return `${start} - ${end}`;
  if (start) return `${start}`;
  return "Time not set";
}

window.toggleInstallationComplete = function toggleInstallationComplete(id, checked) {
  const manual = (state.installations || []).find((it) => it.id === id);
  if (manual) {
    manual.completed = checked;
    manual.completedAt = checked ? todayInputValue() : "";
    persist();
    render();
    return;
  }
  const invoice = findInvoice(id);
  if (!invoice) return;
  invoice.installation ||= normalizeInstallation({}, "installation");
  invoice.installation.completed = checked;
  invoice.installation.completedAt = checked ? todayInputValue() : "";
  persist();
  render();
};

window.deleteManualInstallation = function deleteManualInstallation(id) {
  if (!confirm("Delete this installation?")) return;
  state.installations = (state.installations || []).filter((it) => it.id !== id);
  persist();
  render();
};

function renderFacebookListing(rows) {
  if (!els.facebookBody) return;
  const visibleRows = [...rows].sort((a, b) => {
    const dateCompare = (b.date || "").localeCompare(a.date || "");
    if (dateCompare) return dateCompare;
    return String(b.no || "").localeCompare(String(a.no || ""));
  });
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const activePerson = els.facebookSalespersonFilter?.value || "All";
  const activeStatus = els.facebookStatusFilter?.value || "All";
  els.facebookSummary.textContent = `${activePerson} · ${activeStatus} · ${rows.length} listings · ${currency.format(totalAmount)}`;

  const followUpRows = rows.filter((row) => isFollowUpStatus(row.status));
  const staleFollowUps = followUpRows.filter((row) => followUpNeedsUpdate(row)).length;
  const statusCards = [
    { status: "All", count: rows.length },
    { status: "Follow Up", count: followUpRows.length, alert: staleFollowUps ? "no update" : "" },
    ...["Progressing", "Deal", "Fail"].map((status) => ({
      status,
      count: rows.filter((row) => row.status === status).length,
    })),
  ];
  els.facebookStatusCards.innerHTML = [
    ...statusCards,
  ].map((item) => `
    <article class="facebook-status-card ${facebookStatusCardClass(item)} ${item.status === activeStatus ? "active" : ""} ${item.alert ? "needs-update" : ""}" data-facebook-status-card="${escapeHtml(item.status)}">
      <span>${escapeHtml(item.status)}</span>
      <strong>${item.count}</strong>
      ${item.alert ? `<small>${escapeHtml(item.alert)}</small>` : ""}
    </article>
  `).join("");
  renderFacebookCashCards(rows);
  renderFacebookPostSummary(rows);

  els.facebookBody.innerHTML = visibleRows
    .map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.customerNumber || "")}</td>
        <td>${escapeHtml(row.date || "")}</td>
        <td>${escapeHtml(row.post || "")}</td>
        <td>${escapeHtml(row.source || "")}</td>
        <td>
          <select class="facebook-status-select ${facebookStatusClass(row.status)}" data-facebook-status-select="${row.id}">
            ${FACEBOOK_STATUSES.map((status) => `<option value="${escapeHtml(status)}" ${row.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
          </select>
          <span class="facebook-status-date">${row.statusUpdatedAt ? `Changed ${escapeHtml(row.statusUpdatedAt)}` : ""}</span>
        </td>
        <td><input class="facebook-inline-input facebook-remark-input" value="${escapeHtml(row.remarks || "")}" placeholder="Remark" data-facebook-row="${row.id}" data-facebook-field="remarks" /></td>
        <td>${escapeHtml(row.salesperson || "")}</td>
        <td>${row.status === "Deal" ? `<input class="facebook-inline-input" type="date" value="${escapeHtml(row.dealDateline || "")}" data-facebook-row="${row.id}" data-facebook-field="dealDateline" />` : ""}</td>
        <td>
          ${row.dealDateline ? `
            <select class="facebook-inline-input facebook-invoice-select" title="${escapeHtml(row.invoiceNo || "")}" data-facebook-row="${row.id}" data-facebook-field="invoiceNo">
              ${facebookInvoiceOptions(row)}
            </select>
          ` : ""}
        </td>
        <td class="num">${Number(row.amount || 0) ? currency.format(row.amount) : ""}</td>
        <td class="num">${row.invoiceNo ? currency.format(row.outstanding || 0) : ""}</td>
        <td class="table-actions">
          <button type="button" onclick="editFacebookListing('${row.id}')">Edit</button>
          <button type="button" onclick="deleteFacebookListing('${row.id}')">Delete</button>
        </td>
      </tr>
    `)
    .join("");
}

function renderFacebookPostSummary(rows) {
  if (!els.facebookPostSummary) return;
  const dealsByPost = rows.reduce((acc, row) => {
    if (row.status !== "Deal") return acc;
    const post = cleanText(row.post) || "No post";
    acc[post] = (acc[post] || 0) + Number(row.amount || 0);
    return acc;
  }, {});
  const posts = normalizeFacebookPosts([...(state.settings.facebookPosts || []), ...rows.map((row) => row.post)]);
  els.facebookPostSummary.innerHTML = posts.map((post) => `
    <article class="facebook-post-card">
      <span>${escapeHtml(post)}</span>
      <strong>${currency.format(dealsByPost[post] || 0)}</strong>
    </article>
  `).join("");
}

function renderFacebookCashCards(rows) {
  if (!els.facebookCashCards) return;
  const filters = getFilters();
  // 按月统计(和 Ad Cost 一致):看当月成交日期(dealDateline)落在所选月份的 Deal。
  const months = facebookFilterMonths(filters);
  const dealRows = rows.filter((row) => row.status === "Deal" && months.includes(monthOf(row.dealDateline)));
  const totalDeal = dealRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const received = dealRows.reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0) - Number(row.outstanding || 0)), 0);
  const adCost = facebookAdvertisingCostTotal(filters);
  const profit = received - adCost; // 现金流:当月收到的现金 - 广告花费
  const cards = [
    { label: "This Month Received", value: received, tone: "received", hint: "收到的现金" },
    { label: "This Month Deal", value: totalDeal, tone: "deal", hint: "成交总额" },
    { label: "Ad Cost", value: adCost, tone: "cost", hint: "广告花费" },
    { label: "Profit", value: profit, tone: profit >= 0 ? "profit-good" : "profit-bad", hint: profit >= 0 ? "现金流健康" : "现金流为负" },
  ];
  els.facebookCashCards.innerHTML = cards.map(({ label, value, tone, hint }) => `
    <article class="facebook-cash-card facebook-cash-card--${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${currency.format(value)}</strong>
      <small>${escapeHtml(hint)}</small>
    </article>
  `).join("");
}

function facebookAdvertisingCostTotal(filters = getFilters()) {
  const selectedPerson = els.facebookSalespersonFilter?.value || filters.salesperson || "All";
  const people = selectedPerson !== "All"
    ? [selectedPerson]
    : filters.salesperson !== "All"
      ? [filters.salesperson]
      : getSalespeople();
  return facebookFilterMonths(filters).reduce((total, month) => (
    total + people.reduce((sum, person) => sum + manualAdvertisingCost(person, month), 0)
  ), 0);
}

function facebookFilterMonths(filters = getFilters()) {
  const from = filters.dateFrom || filters.dateTo || todayInputValue();
  const to = filters.dateTo || filters.dateFrom || todayInputValue();
  const [start, end] = [from, to].sort();
  const startMonth = start.slice(0, 7);
  const endMonth = end.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) return [selectedFilterMonth()];
  const months = [];
  let cursor = new Date(`${startMonth}-01T00:00:00`);
  const last = new Date(`${endMonth}-01T00:00:00`);
  while (cursor <= last) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return months;
}

function facebookStatusCardClass(item) {
  if (!item.count) return "";
  return `has-${item.status.toLowerCase().replace(/\s+/g, "-")}`;
}

function isFollowUpStatus(status) {
  return /^Follow Up/i.test(cleanText(status));
}

function reconcileFacebookStatuses() {
  let changed = false;
  state.facebookListings.forEach((row) => {
    if (FACEBOOK_STATUSES.includes(row.status)) return;
    row.status = FACEBOOK_STATUSES[0];
    row.statusUpdatedAt = row.statusUpdatedAt || todayInputValue();
    changed = true;
  });
  if (changed) persist();
}

function followUpNeedsUpdate(row) {
  if (!isFollowUpStatus(row.status) || !row.statusUpdatedAt) return false;
  const updated = new Date(`${row.statusUpdatedAt}T00:00:00`);
  const today = new Date(`${todayInputValue()}T00:00:00`);
  if (Number.isNaN(updated.getTime())) return false;
  return (today - updated) / 86400000 >= 3;
}

function applyFacebookFollowUpDemoDate() {
  let changed = false;
  state.facebookListings.forEach((row) => {
    if (!isFollowUpStatus(row.status)) return;
    if (row.statusUpdatedAt === "2026-06-03") return;
    row.statusUpdatedAt = "2026-06-03";
    changed = true;
  });
  if (changed) persist();
}

function reconcileFacebookDealStatuses() {
  let changed = false;
  state.facebookListings.forEach((row) => {
    if (!row.dealDateline || !row.invoiceNo || row.status === "Deal") return;
    row.status = "Deal";
    row.statusUpdatedAt = todayInputValue();
    changed = true;
  });
  if (changed) persist();
}

function facebookInvoiceMonths(row) {
  const months = [...new Set(state.invoices
    .filter((invoice) => !invoice.trashedAt && (!row.salesperson || invoice.salesperson === row.salesperson))
    .map((invoice) => monthOf(invoice.date) || invoiceMonth(invoice.invoiceNo))
    .filter(Boolean))]
    .sort()
    .reverse();
  const selected = row.invoiceMonth || "";
  if (selected && !months.includes(selected)) months.unshift(selected);
  return months;
}

function facebookInvoiceOptions(row) {
  const selected = cleanText(row.invoiceNo).toUpperCase();
  const selectedMonth = row.invoiceMonth || "";
  const months = facebookInvoiceMonths(row);
  if (!selectedMonth) {
    return [
      `<option value="">Select month</option>`,
      ...months.map((month) => `<option value="month:${escapeHtml(month)}">${escapeHtml(monthLabel(month))}</option>`),
    ].join("");
  }
  const invoices = state.invoices
    .filter((invoice) => {
      if (invoice.trashedAt) return false;
      if (row.salesperson && invoice.salesperson !== row.salesperson) return false;
      const month = monthOf(invoice.date) || invoiceMonth(invoice.invoiceNo);
      return !selectedMonth || month === selectedMonth;
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(a.invoiceNo || "").localeCompare(String(b.invoiceNo || ""), undefined, { numeric: true, sensitivity: "base" }));
  const hasSelected = selected && invoices.some((invoice) => cleanText(invoice.invoiceNo).toUpperCase() === selected);
  return [
    `<option value="">${escapeHtml(monthLabel(selectedMonth))} - Select invoice</option>`,
    `<option value="change-month">Change month</option>`,
    selected && !hasSelected ? `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>` : "",
    ...invoices.map((invoice) => {
      const invoiceNo = cleanText(invoice.invoiceNo).toUpperCase();
      return `<option value="${escapeHtml(invoiceNo)}" ${invoiceNo === selected ? "selected" : ""}>${escapeHtml(`${invoiceNo} - ${currency.format(invoice.amount || 0)}`)}</option>`;
    }),
  ].join("");
}

function monthLabel(month) {
  if (!/^\d{4}-\d{2}$/.test(month || "")) return month || "";
  const [year, monthNo] = month.split("-");
  return new Date(Number(year), Number(monthNo) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function updateFacebookListingStatus(id, status) {
  const row = state.facebookListings.find((item) => item.id === id);
  if (!row || !FACEBOOK_STATUSES.includes(status)) return;
  row.status = status;
  row.statusUpdatedAt = todayInputValue();
  persist();
  render();
}

function populateFacebookPosts(selected = els.facebookPost?.value) {
  if (!els.facebookPost) return;
  const options = normalizeFacebookPosts(state.settings.facebookPosts || DEFAULT_FACEBOOK_POSTS);
  if (selected && !options.includes(selected)) options.push(selected);
  els.facebookPost.innerHTML = options.map((post) => `<option>${escapeHtml(post)}</option>`).join("");
  els.facebookPost.value = options.includes(selected) ? selected : options[0] || "";
  populateFacebookPostDeleteOptions();
}

function populateFacebookPostDeleteOptions() {
  if (!els.facebookPostDeleteSelect) return;
  const selected = els.facebookPostDeleteSelect.value || els.facebookPost?.value || "";
  const posts = normalizeFacebookPosts(state.settings.facebookPosts || DEFAULT_FACEBOOK_POSTS);
  els.facebookPostDeleteSelect.innerHTML = posts.map((post) => `<option>${escapeHtml(post)}</option>`).join("");
  els.facebookPostDeleteSelect.value = posts.includes(selected) ? selected : posts[0] || "";
}

function openFacebookPostDialog() {
  populateFacebookPostDeleteOptions();
  if (els.facebookPostNameInput) els.facebookPostNameInput.value = "";
  if (!els.facebookPostDialog) return;
  if (els.facebookPostDialog.open) els.facebookPostDialog.close();
  if (typeof els.facebookPostDialog.showModal === "function") {
    els.facebookPostDialog.showModal();
  } else {
    els.facebookPostDialog.setAttribute("open", "");
  }
}

function closeFacebookPostDialog() {
  if (els.facebookPostDialog?.open) els.facebookPostDialog.close();
}

function addFacebookPost() {
  const name = cleanText(els.facebookPostNameInput?.value);
  if (!name) {
    alert("Please enter a post name.");
    return;
  }
  const posts = normalizeFacebookPosts(state.settings.facebookPosts || DEFAULT_FACEBOOK_POSTS);
  if (!posts.includes(name)) posts.push(name);
  state.settings.facebookPosts = posts;
  persist();
  populateFacebookPosts(name);
  if (els.facebookPostNameInput) els.facebookPostNameInput.value = "";
  render();
}

function deleteFacebookPost() {
  const selected = cleanText(els.facebookPostDeleteSelect?.value);
  if (!selected) return;
  const posts = normalizeFacebookPosts(state.settings.facebookPosts || DEFAULT_FACEBOOK_POSTS);
  if (posts.length <= 1) {
    alert("Please keep at least one post option.");
    return;
  }
  state.settings.facebookPosts = posts.filter((post) => post !== selected);
  persist();
  populateFacebookPosts();
  populateFacebookPostDeleteOptions();
  render();
}

function updateFacebookListingField(id, field, value) {
  const row = state.facebookListings.find((item) => item.id === id);
  if (!row || !["dealDateline", "invoiceMonth", "invoiceNo", "remarks"].includes(field)) return;
  if (field === "invoiceNo") {
    if (value === "change-month") {
      row.invoiceMonth = "";
      row.invoiceNo = "";
      row.amount = 0;
      row.outstanding = 0;
      persist();
      render();
      return;
    }
    if (String(value).startsWith("month:")) {
      row.invoiceMonth = String(value).slice(6);
      row.invoiceNo = "";
      row.amount = 0;
      row.outstanding = 0;
      persist();
      render();
      return;
    }
    row.invoiceNo = cleanText(value).toUpperCase();
    const invoice = findInvoiceByNo(row.invoiceNo);
    row.amount = Number(invoice?.amount || 0);
    row.outstanding = Number(invoice?.outstanding || 0);
    row.invoiceMonth = row.invoiceNo ? monthOf(invoice?.date) || invoiceMonth(row.invoiceNo) || row.invoiceMonth : row.invoiceMonth;
    if (row.invoiceNo && row.dealDateline && row.status !== "Deal") {
      row.status = "Deal";
      row.statusUpdatedAt = todayInputValue();
    }
  } else if (field === "invoiceMonth") {
    row.invoiceMonth = value;
    row.invoiceNo = "";
    row.amount = 0;
    row.outstanding = 0;
  } else if (field === "dealDateline") {
    row.dealDateline = cleanText(value);
    if (!row.dealDateline) {
      row.invoiceMonth = "";
      row.invoiceNo = "";
      row.amount = 0;
      row.outstanding = 0;
    } else if (row.status !== "Deal") {
      row.status = "Deal";
      row.statusUpdatedAt = todayInputValue();
    }
  } else {
    row[field] = cleanText(value);
  }
  persist();
  render();
}

function saveFacebookListing(event) {
  event.preventDefault();
  const customerNumber = normalizeFacebookCustomerNumber(els.facebookCustomerNumber.value);
  if (!customerNumber) {
    alert("Please enter the customer phone number.");
    return;
  }
  const id = els.facebookId.value || createId();
  const existingIndex = state.facebookListings.findIndex((row) => row.id === id);
  const existing = existingIndex >= 0 ? state.facebookListings[existingIndex] : {};
  const recordDate = els.facebookDate.value || todayInputValue();
  const formStatus = els.facebookStatusInput?.value || existing.status || FACEBOOK_STATUSES[0];
  const record = {
    ...existing,
    id,
    no: existing.no || "",
    invoiceNo: existing.invoiceNo || "",
    date: recordDate,
    customerNumber,
    post: cleanText(els.facebookPost.value),
    source: cleanText(els.facebookSource.value) || "Facebook",
    salesperson: els.facebookSalespersonInput.value,
    dealDateline: existing.dealDateline || "",
    invoiceMonth: existing.invoiceMonth || "",
    amount: Number(existing.amount || 0),
    outstanding: Number(existing.outstanding || 0),
    status: formStatus,
    statusUpdatedAt:
      existing.status && existing.status !== formStatus
        ? todayInputValue()
        : existing.statusUpdatedAt || todayInputValue(),
    remarks: existing.remarks || "",
    importedFrom: existing.importedFrom || "Manual entry",
  };

  if (existingIndex >= 0) {
    state.facebookListings[existingIndex] = record;
  } else {
    state.facebookListings.push(record);
  }
  renumberFacebookListings();
  persist();
  els.dateFromFilter.value = record.date;
  els.dateToFilter.value = record.date;
  els.salespersonFilter.value = "All";
  els.searchInput.value = "";
  if (els.facebookSalespersonFilter) els.facebookSalespersonFilter.value = record.salesperson;
  if (els.facebookStatusFilter) els.facebookStatusFilter.value = "All";
  clearFacebookListingForm();
  closeFacebookListingForm();
  switchView("facebook");
  render();
}

function normalizeFacebookCustomerNumber(value) {
  const digits = cleanText(value).replace(/\D/g, "").replace(/^0+/, "").replace(/^601/, "").replace(/^60/, "");
  return digits ? `+601${digits}` : "";
}

function openFacebookListingForm() {
  if (!els.facebookForm) return;
  clearFacebookListingForm();
  els.facebookForm.classList.remove("hidden");
  els.facebookForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeFacebookListingForm() {
  els.facebookForm?.classList.add("hidden");
}

function clearFacebookListingForm() {
  if (!els.facebookForm) return;
  els.facebookForm.reset();
  els.facebookId.value = "";
  els.facebookModeLabel.textContent = "Record every Facebook lead directly from the website.";
  els.facebookDate.value = todayInputValue();
  els.facebookCustomerNumber.value = "";
  populateFacebookPosts();
  els.facebookSource.value = "Facebook";
  const people = getSalespeople();
  const activePerson = els.facebookSalespersonFilter?.value;
  els.facebookSalespersonInput.value = people.includes(activePerson) ? activePerson : people[0] || "";
  if (els.facebookStatusInput) els.facebookStatusInput.value = FACEBOOK_STATUSES[0];
}

window.editFacebookListing = function editFacebookListing(id) {
  const row = state.facebookListings.find((item) => item.id === id);
  if (!row || !els.facebookForm) return;
  els.facebookForm.classList.remove("hidden");
  els.facebookId.value = row.id;
  els.facebookDate.value = row.date || todayInputValue();
  els.facebookCustomerNumber.value = String(row.customerNumber || "").replace(/^\+?601/, "");
  populateFacebookPosts(row.post || "");
  els.facebookSource.value = row.source || "Facebook";
  els.facebookSalespersonInput.value = row.salesperson || getSalespeople()[0] || "";
  if (els.facebookStatusInput) els.facebookStatusInput.value = FACEBOOK_STATUSES.includes(row.status) ? row.status : FACEBOOK_STATUSES[0];
  els.facebookModeLabel.textContent = `Editing ${row.customerNumber || "Facebook customer"}`;
  els.facebookForm.scrollIntoView({ behavior: "smooth", block: "start" });
};

window.deleteFacebookListing = function deleteFacebookListing(id) {
  const row = state.facebookListings.find((item) => item.id === id);
  if (!row) return;
  if (!confirm(`Delete Facebook listing for ${row.customerNumber || row.invoiceNo || "this customer"}?`)) return;
  state.facebookListings = state.facebookListings.filter((item) => item.id !== id);
  renumberFacebookListings();
  persist();
  if (els.facebookId?.value === id) clearFacebookListingForm();
  render();
};

function facebookStatusClass(status) {
  return cleanText(status).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "unknown";
}

function updateUploadFields() {
  const isInvoiceUpload = els.importType.value === "invoice";
  document.querySelectorAll(".invoice-upload-only").forEach((element) => {
    element.classList.toggle("hidden", !isInvoiceUpload);
  });
}

function renderSelectionMode() {
  document.querySelector("#invoicesView").classList.toggle("selection-active", selectionMode.invoices);
  document.querySelector("#costsView").classList.toggle("selection-active", selectionMode.costs);
  document.querySelector("#trashSelectedInvoicesButton").textContent = selectionMode.invoices ? "Move to trash" : "Select";
  document.querySelector("#trashSelectedCostsButton").textContent = selectionMode.costs ? "Move to trash" : "Select";
  document.querySelector("#cancelInvoiceSelectionButton").classList.toggle("hidden", !selectionMode.invoices);
  document.querySelector("#cancelCostSelectionButton").classList.toggle("hidden", !selectionMode.costs);
}

function renderBranding() {
  els.brandLogo.src = state.settings.logoImage || DEFAULT_LOGO_IMAGE;
  if (els.logoPreview) els.logoPreview.src = state.settings.logoImage || DEFAULT_LOGO_IMAGE;
}

function openSettingsDialog(id) {
  const dialog = document.querySelector(`#${id}`);
  if (!dialog) return;
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeSettingsDialog(id) {
  const dialog = document.querySelector(`#${id}`);
  if (!dialog) return;
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function openPictureSettings() {
  openSettingsDialog("pictureSettingsDialog");
}

function closePictureSettings() {
  closeSettingsDialog("pictureSettingsDialog");
}

function renderSettings() {
  const tiers = state.settings.salesPersonAvatarTiers || {};
  if (els.avatarDefaultPreview) els.avatarDefaultPreview.src = tiers.default || DEFAULT_SALES_PERSON_IMAGE;
  if (els.avatar20Preview) els.avatar20Preview.src = tiers.tier20 || tiers.default || DEFAULT_SALES_PERSON_IMAGE;
  if (els.avatar50Preview) els.avatar50Preview.src = tiers.tier50 || tiers.tier20 || tiers.default || DEFAULT_SALES_PERSON_IMAGE;
  if (els.avatar100Preview) els.avatar100Preview.src = tiers.tier100 || tiers.tier50 || tiers.tier20 || tiers.default || DEFAULT_SALES_PERSON_IMAGE;
  renderAgentSettings();
  renderAccountDetailSettings();
}

function renderAgentSettings() {
  if (!els.agentTableBody) return;
  const agents = state.settings.agents || [];
  els.agentTableBody.innerHTML = agents.length
    ? agents.map((agent) => `
      <tr>
        <td><strong>${escapeHtml(agent.name)}</strong></td>
        <td>${escapeHtml(agent.salesperson || "")}</td>
        <td class="table-actions"><button type="button" onclick="deleteAgent('${agent.id}')">Delete</button></td>
      </tr>
    `).join("")
    : `<tr><td colspan="3" class="empty">No agents yet.</td></tr>`;
}

function renderAccountDetailSettings() {
  if (!els.accountDetailForm) return;
  const detail = state.settings.accountDetail || {};
  if (document.activeElement && els.accountDetailForm.contains(document.activeElement)) return;
  els.accountNameInput.value = detail.name || "";
  els.accountEmailInput.value = detail.email || "";
  els.accountAddressInput.value = detail.address || "";
  if (els.accountPhoneInput) els.accountPhoneInput.value = detail.phoneNumber || "";
  els.accountNewPasswordInput.value = "";
  els.accountConfirmPasswordInput.value = "";
}

function addAgent() {
  const name = cleanText(els.agentNameInput?.value);
  const salesperson = cleanText(els.agentSalespersonSelect?.value);
  if (!name) {
    alert("Please enter the agent name.");
    return;
  }
  state.settings.agents ||= [];
  const existing = state.settings.agents.find((agent) => agent.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.salesperson = salesperson;
  } else {
    state.settings.agents.push({ id: createId(), name, salesperson });
  }
  if (els.agentNameInput) els.agentNameInput.value = "";
  persist();
  render();
}

window.deleteAgent = function deleteAgent(id) {
  state.settings.agents = (state.settings.agents || []).filter((agent) => agent.id !== id);
  persist();
  render();
};

function saveAccountDetail(event) {
  event.preventDefault();
  const newPassword = els.accountNewPasswordInput?.value || "";
  const confirmPassword = els.accountConfirmPasswordInput?.value || "";
  if (newPassword || confirmPassword) {
    if (newPassword !== confirmPassword) {
      alert("New password and confirm new password do not match.");
      return;
    }
    if (newPassword.length < 6) {
      alert("Please use at least 6 characters for the new password.");
      return;
    }
  }
  state.settings.accountDetail = {
    name: cleanText(els.accountNameInput?.value),
    email: cleanText(els.accountEmailInput?.value),
    address: cleanText(els.accountAddressInput?.value),
    phoneNumber: cleanText(els.accountPhoneInput?.value),
    passwordUpdatedAt: newPassword ? todayInputValue() : state.settings.accountDetail?.passwordUpdatedAt || "",
  };
  if (els.accountNewPasswordInput) els.accountNewPasswordInput.value = "";
  if (els.accountConfirmPasswordInput) els.accountConfirmPasswordInput.value = "";
  if (els.accountSaveStatus) els.accountSaveStatus.textContent = "Saved.";
  persist();
  render();
}

function importImageSetting(event, key) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Please choose an image file.");
    event.target.value = "";
    return;
  }
  if (file.size > 2_500_000) {
    alert("This image is too large. Please use an image below 2.5MB.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.settings[key] = reader.result;
    persist();
    render();
    event.target.value = "";
  };
  reader.readAsDataURL(file);
}

window.editSalesPersonImage = function editSalesPersonImage(name) {
  editingSalesPersonImage = name;
  els.salesPersonImageInput.click();
};

function importSalesPersonImage(event) {
  const name = editingSalesPersonImage;
  if (!name) {
    event.target.value = "";
    return;
  }
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Please choose an image file.");
    event.target.value = "";
    return;
  }
  if (file.size > 2_500_000) {
    alert("This image is too large. Please use an image below 2.5MB.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.settings.salesPersonImages ||= {};
    state.settings.salesPersonImages[name] = reader.result;
    persist();
    render();
    editingSalesPersonImage = "";
    event.target.value = "";
  };
  reader.readAsDataURL(file);
}

function importAvatarTierImage(event) {
  const tier = editingAvatarTier;
  const file = event.target.files[0];
  if (!tier || !file) {
    editingAvatarTier = "";
    event.target.value = "";
    return;
  }
  if (!file.type.startsWith("image/")) {
    alert("Please choose an image file.");
    event.target.value = "";
    return;
  }
  if (file.size > 2_500_000) {
    alert("This image is too large. Please use an image below 2.5MB.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.settings.salesPersonAvatarTiers ||= {};
    state.settings.salesPersonAvatarTiers[tier] = reader.result;
    if (tier === "default") state.settings.salesPersonImage = reader.result;
    persist();
    render();
    editingAvatarTier = "";
    event.target.value = "";
  };
  reader.readAsDataURL(file);
}

function editSalesperson(name) {
  els.editingSalespersonOriginalName.value = name;
  els.editingSalespersonName.value = name;
  els.editingSalespersonImage.value = "";
  els.salesPersonEditPreview.src = state.settings.salesPersonImages?.[name] || state.settings.salesPersonImage || DEFAULT_SALES_PERSON_IMAGE;
  els.salesPersonEditPanel.classList.remove("hidden");
  els.editingSalespersonName.focus();
}

function cancelSalespersonEdit() {
  els.salesPersonEditPanel.classList.add("hidden");
  els.editingSalespersonOriginalName.value = "";
  els.editingSalespersonName.value = "";
  els.editingSalespersonImage.value = "";
}

function previewSalespersonEditImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Please choose an image file.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    els.salesPersonEditPreview.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function saveSalespersonEdit(event) {
  event.preventDefault();
  const oldName = els.editingSalespersonOriginalName.value;
  const newName = cleanText(els.editingSalespersonName.value);
  const file = els.editingSalespersonImage.files[0];
  if (!oldName || !newName) {
    alert("Please enter a sales person name.");
    return;
  }
  const duplicate = getSalespeople().find((person) => person.toLowerCase() === newName.toLowerCase() && person !== oldName);
  if (duplicate) {
    alert(`${duplicate} already exists.`);
    return;
  }
  if (file) {
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }
    if (file.size > 2_500_000) {
      alert("This image is too large. Please use an image below 2.5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      commitSalespersonEdit(oldName, newName, reader.result);
    };
    reader.readAsDataURL(file);
    return;
  }
  commitSalespersonEdit(oldName, newName, "");
}

function commitSalespersonEdit(oldName, newName, imageData) {
  if (newName !== oldName) renameSalesperson(oldName, newName);
  state.settings.salesPersonImages ||= {};
  if (imageData) state.settings.salesPersonImages[newName] = imageData;
  persist();
  populateSalespeople();
  cancelSalespersonEdit();
  render();
}

function renameSalesperson(oldName, newName) {
  state.settings.salespeople = getSalespeople().map((person) => (person === oldName ? newName : person));
  state.invoices.forEach((invoice) => {
    if (invoice.salesperson === oldName) invoice.salesperson = newName;
  });
  state.costs.forEach((cost) => {
    if (cost.owner === oldName) cost.owner = newName;
    if (cleanText(cost.linkedInvoiceNo).toLowerCase() === oldName.toLowerCase()) cost.linkedInvoiceNo = newName;
  });
  state.facebookListings.forEach((row) => {
    if (row.salesperson === oldName) row.salesperson = newName;
  });
  if (state.settings.salesPersonImages?.[oldName]) {
    state.settings.salesPersonImages[newName] = state.settings.salesPersonImages[oldName];
    delete state.settings.salesPersonImages[oldName];
  }
}

function addSalesperson() {
  const name = cleanText(els.newSalespersonName.value);
  if (!name) {
    alert("Please enter a sales person name.");
    return;
  }
  const existing = getSalespeople().find((person) => person.toLowerCase() === name.toLowerCase());
  if (existing) {
    alert(`${existing} already exists.`);
    els.newSalespersonName.value = "";
    return;
  }
  state.settings.salespeople = [...getSalespeople(), name];
  persist();
  populateSalespeople();
  els.salespersonFilter.value = name;
  els.importSalesperson.value = name;
  document.querySelector("#invoiceSalesperson").value = name;
  els.newSalespersonName.value = "";
  render();
}

function deleteSalesperson(name) {
  if (getSalespeople().length <= 1) {
    alert("You must keep at least one sales person.");
    return;
  }
  const activeInvoices = state.invoices.filter((invoice) => !invoice.trashedAt && invoice.salesperson === name).length;
  const message = activeInvoices
    ? `${name} has ${activeInvoices} active invoices. Remove this sales person from selection lists?\n\nExisting records will not be deleted.`
    : `Remove ${name} from sales person lists?`;
  if (!confirm(message)) return;
  state.settings.salespeople = getSalespeople().filter((person) => person !== name);
  if (state.settings.salesPersonImages) delete state.settings.salesPersonImages[name];
  persist();
  populateSalespeople();
  render();
}

function renderSalespersonManager() {
  if (!els.salespersonManagerBody) return;
  els.salespersonManagerBody.innerHTML = getSalespeople()
    .map((name) => {
      const rows = state.invoices.filter((invoice) => !invoice.trashedAt && invoice.salesperson === name);
      const sales = rows.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
      return `
        <tr>
          <td><strong>${escapeHtml(name)}</strong></td>
          <td>${rows.length}</td>
          <td class="num">${currency.format(sales)}</td>
          <td class="table-actions">
            <button type="button" class="edit-salesperson-button" data-name="${escapeHtml(name)}">Edit</button>
            <button class="danger-outline delete-salesperson-button" type="button" data-name="${escapeHtml(name)}">Delete</button>
          </td>
        </tr>`;
    })
    .join("");
}

function renderKpis(invoices, costs) {
  const t = totals(invoices);
  const costMetrics = summarizeCosts(costs);
  const dashboardProfit = t.sales - costMetrics.allCost;
  const margin = t.sales ? (dashboardProfit / t.sales) * 100 : 0;
  const values = [
    ["Invoice Sales", currency.format(t.sales)],
    ["All Cost", currency.format(costMetrics.allCost)],
    ["Unlinked Cost", currency.format(costMetrics.unlinkedIssueCost)],
    ["Production Cost", currency.format(costMetrics.productionCost)],
    ["Profit", currency.format(dashboardProfit)],
    ["Outstanding", currency.format(t.outstanding)],
    ["Agent Sales", currency.format(t.agentOrder)],
    ["Margin", `${margin.toFixed(1)}%`],
  ];
  els.kpiGrid.innerHTML = values.map(([label, value], index) => `
    <div class="kpi kpi-card-${index + 1}">
      <span class="kpi-label">${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
  const filters = getFilters();
  const scope = filters.dateFrom && filters.dateTo ? `${filters.dateFrom} to ${filters.dateTo}` : filters.dateFrom || filters.dateTo || "All dates";
  els.dashboardScope.textContent = `${scope} performance`;
}

function kpiIcon(type) {
  const paths = {
    invoice: '<path d="M7 3h7l3 3v15H7z"/><path d="M14 3v4h4"/><path d="M10 11h5M10 15h6"/>',
    layers: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
    atom: '<path d="M12 12h.01"/><path d="M19.1 4.9c2.2 2.2-.7 8.7-6.4 14.4-5.7 5.7-12.2 8.6-14.4 6.4"/><path d="M4.9 4.9c-2.2 2.2.7 8.7 6.4 14.4 5.7 5.7 12.2 8.6 14.4 6.4" transform="translate(-3 -3)"/>',
    cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12 4 7.5M12 12l8-4.5M12 12v9"/>',
    trend: '<path d="M4 17 9 12l4 3 7-8"/><path d="M16 7h4v4"/>',
    wallet: '<path d="M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4z"/><path d="M4 7V5a2 2 0 0 1 2-2h11v4"/><path d="M17 13h.01"/>',
    person: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    pie: '<path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M12 3a9 9 0 0 1 9 9h-9z"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type] || paths.trend}</svg>`;
}

function summarizeCosts(costs) {
  return costs.reduce(
    (acc, cost) => {
      const amount = Number(cost.amount || 0);
      const owner = costOwner(cost);
      const linkedInvoice = linkedInvoiceForCost(cost);
      acc.allCost += amount;
      if (linkedInvoice) acc.linkedCost += amount;
      else acc.notLinkedCost += amount;
      if (owner === "Production") acc.productionCost += amount;
      if (owner === "Unlinked") acc.unlinkedIssueCost += amount;
      return acc;
    },
    { allCost: 0, linkedCost: 0, notLinkedCost: 0, productionCost: 0, unlinkedIssueCost: 0 },
  );
}

function renderSalespeople(invoices) {
  if (!els.salespersonCards) return;
  // 选中某个销售员时,只显示这个人的卡片(头像、数据都只是他/她的);选 All 才显示全部。
  const selectedPerson = els.salespersonFilter?.value || "All";
  const rankedPeople = getSalespeople()
    .filter((name) => selectedPerson === "All" || name === selectedPerson)
    .map((name) => {
      const rows = invoices.filter((invoice) => invoice.salesperson === name);
      const t = totals(rows);
      return { name, rows, totals: t };
    })
    .sort((a, b) => b.totals.sales - a.totals.sales || a.name.localeCompare(b.name));

  els.salespersonCards.innerHTML = rankedPeople.map(({ name, rows, totals: t }) => {
      const personCosts = getFilteredCosts().filter((cost) => costOwner(cost) === name);
      const costMetrics = summarizeCosts(personCosts);
      const profit = t.sales - costMetrics.allCost;
      const margin = t.sales ? (profit / t.sales) * 100 : 0;
      return `
      <article class="person-card">
        <div class="mascot-frame">
          ${jellyfishMascot(name, t.sales)}
        </div>
        <div class="person-nameplate">
          <h4>${name}</h4>
          <span>${t.count} invoices</span>
        </div>
        <dl>
          <div class="metric-row"><dt>Sales</dt><dd>${currency.format(t.sales)}</dd></div>
          <div class="metric-row"><dt>Agent Sales</dt><dd>${currency.format(t.agentOrder)}</dd></div>
          <div class="metric-row"><dt>Cost</dt><dd>${currency.format(costMetrics.allCost)}</dd></div>
          <div class="metric-row"><dt>Profit</dt><dd>${currency.format(profit)}</dd></div>
          <div class="metric-row"><dt>Outstanding</dt><dd>${currency.format(t.outstanding)}</dd></div>
          <div class="metric-row"><dt>Margin</dt><dd>${margin.toFixed(1)}%</dd></div>
        </dl>
      </article>`;
    }).join("");
}

function jellyfishMascot(name, sales = 0) {
  const image = salesPersonAvatarImage(name, sales);
  return `<img class="jellyfish" src="${escapeHtml(image)}" alt="${escapeHtml(name)} sales person mascot" />`;
}

function salesPersonAvatarImage(name, sales) {
  const tiers = state.settings.salesPersonAvatarTiers || {};
  if (state.settings.salesPersonImages?.[name]) return state.settings.salesPersonImages[name];
  if (Number(sales || 0) >= 100000 && tiers.tier100) return tiers.tier100;
  if (Number(sales || 0) >= 50000 && tiers.tier50) return tiers.tier50;
  if (Number(sales || 0) >= 20000 && tiers.tier20) return tiers.tier20;
  return tiers.default || state.settings.salesPersonImage || DEFAULT_SALES_PERSON_IMAGE;
}

function renderUntickedInvoices(invoices) {
  const unticked = invoices.filter((invoice) => !invoice.settled);
  els.costTypeBars.classList.add("unticked-invoice-list");
  if (!unticked.length) {
    els.costTypeBars.innerHTML = `<p class="empty">All invoices in this filter are ticked.</p>`;
    return;
  }
  els.costTypeBars.innerHTML = unticked
    .map((invoice) => `
      <div class="linked-row unticked-invoice-row">
        <div>
          <strong>${escapeHtml(invoice.invoiceNo)}</strong>
          <small>${escapeHtml(invoice.salesperson)} · ${escapeHtml(invoice.date || "")}${invoice.customer ? ` · ${escapeHtml(invoice.customer)}` : ""}</small>
        </div>
        <strong>${currency.format(invoice.amount || 0)}</strong>
      </div>
    `)
    .join("");
}

function renderSalesScorecard() {
  if (!els.scorecardMetrics) return;
  const data = scorecardData();
  els.scorecardTitle.textContent = `${data.salesperson.toUpperCase()} | ${data.monthLabel}`;
  els.scorecardSubtitle.textContent = "Sales performance and commission statement";
  els.scorecardMetrics.innerHTML = [
    ["Total Sales", data.sales, "blue", "sales"],
    ["End User Profit", data.profit, "green", "profit"],
    ["Profit Late", data.lateProfit, "orange", "lateProfit"],
    ["Late Cost", -data.lateCost, "red", "lateCost"],
    ["Advertising Cost", -data.advertisingCost, "red", "advertisingCost"],
    ["Net Profit", data.netProfit, "cyan", "netProfit"],
  ]
    .map(([label, value, tone, detail]) => `
      <article
        class="score-metric ${tone} ${detail ? "clickable" : ""}"
        ${detail ? `data-scorecard-detail="${escapeHtml(detail)}" role="button" tabindex="0" aria-label="Show ${escapeHtml(label)} invoice detail" title="Click to view invoice records"` : ""}
      >
        <span>${label}</span>
        <strong>${currency.format(value)}</strong>
        <small>${scorecardMetricHint(label, data)}</small>
      </article>
    `)
    .join("");
  bindScorecardMetricCards();
  els.scorecardCommission.textContent = currency.format(data.commission);
  if (els.scorecardRate) els.scorecardRate.textContent = `${data.commissionRate.toFixed(1).replace(/\.0$/, "")}%`;
  if (els.scorecardRateInput) els.scorecardRateInput.value = data.commissionRate;
  els.scorecardProfitActual.textContent = currency.format(data.netProfit);
  els.scorecardSalesActual.textContent = currency.format(data.sales);
  els.scorecardPayout.textContent = currency.format(data.commission);
  els.scorecardProfitProgress.style.width = `${Math.min(data.profitProgress, 100)}%`;
  els.scorecardSalesProgress.style.width = `${Math.min(data.salesProgress, 100)}%`;
  els.scorecardNote.textContent = `Generated from ${data.invoiceCount} invoices and ${data.costCount} cost bills for ${data.monthLabel}.`;
}

function scorecardData() {
  const filters = getFilters();
  const month = els.scorecardMonth?.value || filters.filterMonth || new Date().toISOString().slice(0, 7);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;
  const monthFilters = { ...filters, dateFrom: monthStart, dateTo: monthEnd, search: "" };
  const people = getSalespeople();
  const selectedPerson = els.scorecardSalesperson?.value || (filters.salesperson === "All" ? topSalespersonForMonth(month, people) : filters.salesperson);
  const invoices = state.invoices.filter((invoice) => !invoice.trashedAt && invoice.salesperson === selectedPerson && matchesDateRange(invoice.date, monthFilters));
  const profitInvoices = invoices.filter((invoice) => invoice.settled && monthOf(invoice.settledAt || invoice.date) === month);
  const lateInvoices = state.invoices.filter((invoice) => {
    if (invoice.trashedAt || invoice.salesperson !== selectedPerson || !invoice.settled) return false;
    const settledMonth = monthOf(invoice.settledAt || invoice.date);
    return settledMonth === month && monthOf(invoice.date) !== month;
  });
  const costs = state.costs.filter((cost) => {
    if (cost.trashedAt || !matchesDateRange(cost.date, monthFilters)) return false;
    return costOwner(cost) === selectedPerson;
  });
  const lateCosts = state.costs.filter((cost) => {
    if (cost.trashedAt || !cost.lateCost) return false;
    return monthOf(cost.lateCostAt || cost.date) === month && costOwner(cost) === selectedPerson;
  });
  const sales = invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const profit = profitInvoices.reduce((sum, invoice) => sum + invoiceProfit(invoice), 0);
  const lateProfit = lateInvoices.reduce((sum, invoice) => sum + invoiceProfit(invoice), 0);
  const lateCost = lateCosts.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
  const advertisingCost = manualAdvertisingCost(selectedPerson, month);
  const netProfit = profit + lateProfit - lateCost - advertisingCost;
  const commissionRate = Number(state.settings.commissionRate ?? 20);
  const commission = Math.max(0, netProfit * (commissionRate / 100));
  return {
    salesperson: selectedPerson || "Sales Person",
    month,
    monthLabel: formatMonthLabel(month),
    invoiceCount: invoices.length,
    costCount: costs.length,
    lateInvoiceCount: lateInvoices.length,
    lateCostCount: lateCosts.length,
    sales,
    profit,
    lateProfit,
    lateCost,
    advertisingCost,
    netProfit,
    commission,
    commissionRate,
    salesInvoices: invoices,
    profitInvoices,
    lateInvoices,
    lateCosts,
    advertisingCosts: advertisingCost ? [{ docNo: "Manual Advertising", type: "Advertising Cost", date: month, amount: advertisingCost }] : [],
    profitProgress: (netProfit / 15000) * 100,
    salesProgress: (sales / 80000) * 100,
  };
}

function topSalespersonForMonth(month, people) {
  return people
    .map((name) => ({
      name,
      sales: state.invoices
        .filter((invoice) => !invoice.trashedAt && invoice.salesperson === name && invoice.date?.startsWith(month))
        .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    }))
    .sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name))[0]?.name || people[0] || "";
}

function isAdvertisingCost(cost) {
  const text = `${cost.type} ${cost.docNo} ${cost.note}`.toLowerCase();
  return /advertis|advertiser|advertising|\bads?\b|google|facebook|meta|boost|广告/.test(text);
}

function scorecardMetricHint(label, data) {
  if (label === "Profit Late") return `${data.lateInvoiceCount} late invoices checked`;
  if (label === "Late Cost") return `${data.lateCostCount} late costs checked`;
  if (label === "Advertising Cost") return "Click to enter manually";
  if (label === "Net Profit") return "Commission base";
  if (label === "Total Sales") return `${data.salesperson} · ${data.monthLabel}`;
  return "Selected month";
}

function updateCommissionRate() {
  const value = Number(els.scorecardRateInput?.value || 0);
  state.settings.commissionRate = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  persist();
  renderSalesScorecard();
}

function bindScorecardMetricCards() {
  els.scorecardMetrics?.querySelectorAll("[data-scorecard-detail]").forEach((card) => {
    const type = card.dataset.scorecardDetail;
    card.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.showScorecardDetail(type);
    };
    card.onkeydown = (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      window.showScorecardDetail(type);
    };
  });
}

function openScorecardDetailFromEvent(event) {
  const card = event.target.closest("[data-scorecard-detail]");
  if (!card || !els.scorecardMetrics?.contains(card)) return;
  if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  window.showScorecardDetail(card.dataset.scorecardDetail);
}

window.showScorecardDetail = function showScorecardDetail(type) {
  const data = scorecardData();
  const config = {
    sales: {
      title: "Total Sales Invoices",
      summary: `${data.salesperson} · ${data.monthLabel} · ${currency.format(data.sales)}`,
      rows: data.salesInvoices,
      kind: "invoice",
    },
    lateProfit: {
      title: "Profit Late Invoices",
      summary: `${data.lateInvoiceCount} invoice · ${currency.format(data.lateProfit)}`,
      rows: data.lateInvoices,
      kind: "invoice",
    },
    profit: {
      title: "End User Profit Invoices",
      summary: `${data.profitInvoices.length} invoice · ${currency.format(data.profit)}`,
      rows: data.profitInvoices,
      kind: "invoice",
    },
    lateCost: {
      title: "Late Cost Linked Invoices",
      summary: `${data.lateCostCount} cost bill · ${currency.format(data.lateCost)}`,
      rows: data.lateCosts,
      kind: "cost",
    },
    advertisingCost: {
      title: "Advertising Cost Detail",
      summary: `${data.advertisingCosts.length} cost bill · ${currency.format(data.advertisingCost)}`,
      rows: data.advertisingCosts,
      kind: "cost",
    },
    netProfit: {
      title: "Net Profit Invoice Detail",
      summary: `Profit ${currency.format(data.profit)} + Late Profit ${currency.format(data.lateProfit)} - Late Cost ${currency.format(data.lateCost)} - Advertising ${currency.format(data.advertisingCost)} = ${currency.format(data.netProfit)}`,
      rows: [...data.profitInvoices, ...data.lateInvoices],
      kind: "invoice",
    },
  }[type];
  if (!config || !els.scorecardDetailDialog) return;
  els.scorecardDetailTitle.textContent = config.title;
  els.scorecardDetailSummary.textContent = config.summary;
  els.scorecardDetailBody.innerHTML = renderScorecardDetailRows(config.rows, config.kind);
  openScorecardDetailDialog();
};

function openScorecardDetailDialog() {
  if (!els.scorecardDetailDialog) return;
  if (els.scorecardDetailDialog.open) els.scorecardDetailDialog.close();
  if (typeof els.scorecardDetailDialog.showModal === "function") {
    els.scorecardDetailDialog.showModal();
    return;
  }
  els.scorecardDetailDialog.setAttribute("open", "");
}

function renderScorecardDetailRows(rows, kind) {
  if (!rows.length) return `<p class="empty">No records in this item.</p>`;
  if (kind === "cost") {
    return `
      <table class="scorecard-detail-table">
        <thead><tr><th>Cost Doc</th><th>Type</th><th>Linked Invoice</th><th>Date</th><th>Tick Date</th><th>Amount</th></tr></thead>
        <tbody>${rows.map((cost) => {
          const invoice = linkedInvoiceForCost(cost);
          return `<tr>
            <td><strong>${escapeHtml(cost.docNo)}</strong></td>
            <td>${escapeHtml(cost.type)}</td>
            <td>${escapeHtml(costLinkLabel(cost, invoice))}</td>
            <td>${escapeHtml(cost.date || "")}</td>
            <td>${escapeHtml(formatTickDate(cost.lateCostAt || ""))}</td>
            <td class="num">${currency.format(cost.amount || 0)}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>`;
  }
  return `
    <table class="scorecard-detail-table">
      <thead><tr><th>Invoice</th><th>Date</th><th>Tick Date</th><th>Customer</th><th>Sales</th><th>Cost</th><th>Profit</th></tr></thead>
      <tbody>${rows.map((invoice) => `<tr>
        <td><strong>${escapeHtml(invoice.invoiceNo)}</strong></td>
        <td>${escapeHtml(invoice.date || "")}</td>
        <td>${escapeHtml(formatTickDate(invoice.settledAt || ""))}</td>
        <td>${escapeHtml(invoice.customer || "")}</td>
        <td class="num">${currency.format(invoice.amount || 0)}</td>
        <td class="num">${currency.format(invoiceCostTotal(invoice))}</td>
        <td class="num profit">${currency.format(invoiceProfit(invoice))}</td>
      </tr>`).join("")}</tbody>
    </table>`;
}

async function editAdvertisingCost(data = scorecardData()) {
  const current = Number(data.advertisingCost || 0);
  const amount = await requestAdvertisingCostAmount(data, current);
  if (amount === null) return;
  state.settings.advertisingCosts ||= {};
  state.settings.advertisingCosts[advertisingCostKey(data.salesperson, data.month)] = amount;
  persist();
  renderSalesScorecard();
}

function requestAdvertisingCostAmount(data, current = 0) {
  if (!els.advertisingCostDialog) {
    const value = prompt(`Enter advertising cost for ${data.salesperson} ${data.monthLabel}:`, String(current));
    if (value === null) return Promise.resolve(null);
    const amount = Number(String(value).replace(/,/g, ""));
    if (Number.isFinite(amount) && amount >= 0) return Promise.resolve(amount);
    alert("Please enter a valid amount.");
    return requestAdvertisingCostAmount(data, current);
  }

  els.advertisingCostMessage.textContent = `Enter advertising cost for ${data.salesperson} ${data.monthLabel}.`;
  els.advertisingCostInput.value = Number(current || 0).toFixed(2);

  return new Promise((resolve) => {
    const cleanup = (value) => {
      els.advertisingCostConfirm.removeEventListener("click", confirmAmount);
      els.advertisingCostCancel.removeEventListener("click", cancelAmount);
      els.advertisingCostDialog.removeEventListener("cancel", cancelAmount);
      if (els.advertisingCostDialog.open) els.advertisingCostDialog.close();
      resolve(value);
    };
    const confirmAmount = () => {
      if (!els.advertisingCostInput.reportValidity()) return;
      const amount = Number(String(els.advertisingCostInput.value).replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount < 0) {
        alert("Please enter a valid amount.");
        return;
      }
      cleanup(amount);
    };
    const cancelAmount = (event) => {
      event?.preventDefault();
      cleanup(null);
    };
    els.advertisingCostConfirm.addEventListener("click", confirmAmount);
    els.advertisingCostCancel.addEventListener("click", cancelAmount);
    els.advertisingCostDialog.addEventListener("cancel", cancelAmount);
    els.advertisingCostDialog.showModal();
    els.advertisingCostInput.focus();
    els.advertisingCostInput.select();
  });
}

function closeScorecardDetail() {
  if (els.scorecardDetailDialog?.open) els.scorecardDetailDialog.close();
}

function formatMonthLabel(month) {
  if (!month) return "Current Month";
  const [year, monthNo] = month.split("-");
  const names = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${names[Number(monthNo) - 1] || monthNo} ${year}`;
}

function renderTargetChart() {
  if (!els.targetChart) return;
  const canvas = els.targetChart;
  const ctx = setupCanvas(canvas);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);

  const year = "2026";
  const monthlyTarget = 1000000;
  const yearlyTarget = 10000000;
  const months = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  const rows = months.map((month) => {
    const sales = state.invoices
      .filter((invoice) => !invoice.trashedAt && invoice.date?.startsWith(month))
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    return { month, sales };
  });
  let cumulative = 0;
  rows.forEach((row) => {
    cumulative += row.sales;
    row.cumulative = cumulative;
  });

  const pad = 34;
  const chartTop = 22;
  const chartBottom = height - 28;
  const max = Math.max(monthlyTarget, ...rows.map((row) => row.sales), 1);
  const cumulativeMax = Math.max(yearlyTarget, ...rows.map((row) => row.cumulative), 1);
  const barArea = width - pad * 2;
  const step = barArea / rows.length;
  const barWidth = Math.max(10, step * 0.52);

  const panelGlow = ctx.createLinearGradient(0, chartTop, width, chartBottom);
  panelGlow.addColorStop(0, "rgba(125,85,255,.16)");
  panelGlow.addColorStop(1, "rgba(36,196,255,.12)");
  ctx.fillStyle = panelGlow;
  ctx.fillRect(pad, chartTop, width - pad * 2, chartBottom - chartTop);

  rows.forEach((row, index) => {
    const x = pad + index * step;
    ctx.fillStyle = index % 2 ? "rgba(36,196,255,.035)" : "rgba(125,85,255,.06)";
    ctx.fillRect(x, chartTop, step, chartBottom - chartTop);
  });

  ctx.strokeStyle = "rgba(126,146,255,.2)";
  ctx.lineWidth = 1;
  [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
    const y = chartBottom - ratio * (chartBottom - chartTop);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(205,214,255,.72)";
    ctx.font = "10px Segoe UI";
    ctx.fillText(ratio ? `${ratio.toFixed(2)}M` : "0", 2, y + 3);
  });

  const gradient = ctx.createLinearGradient(0, chartTop, 0, chartBottom);
  gradient.addColorStop(0, "#24c4ff");
  gradient.addColorStop(0.45, "#7d55ff");
  gradient.addColorStop(1, "#7d55ff");

  rows.forEach((row, index) => {
    const x = pad + index * step + (step - barWidth) / 2;
    const barHeight = (row.sales / max) * (chartBottom - chartTop);
    const y = chartBottom - barHeight;
    ctx.fillStyle = "rgba(255,255,255,.045)";
    ctx.fillRect(x, chartTop, barWidth, chartBottom - chartTop);
    ctx.shadowColor = "rgba(36,196,255,.48)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,.2)";
    ctx.fillRect(x + 2, y + 2, Math.max(2, barWidth * 0.22), Math.max(0, barHeight - 4));
    ctx.fillStyle = row.sales >= monthlyTarget ? "#24e7ff" : "#8b5cf6";
    ctx.beginPath();
    ctx.arc(x + barWidth / 2, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  const cumulativePoints = rows.map((row, index) => ({
    x: pad + index * step + step / 2,
    y: chartBottom - (row.cumulative / cumulativeMax) * (chartBottom - chartTop),
  }));
  ctx.strokeStyle = "#24e7ff";
  ctx.lineWidth = 2.4;
  ctx.shadowColor = "rgba(36,231,255,.55)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  cumulativePoints.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#24e7ff";
  cumulativePoints.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  });

  const targetY = chartBottom - (monthlyTarget / max) * (chartBottom - chartTop);
  ctx.strokeStyle = "#8b5cf6";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(pad, targetY);
  ctx.lineTo(width - pad, targetY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = "11px Segoe UI";
  ctx.fillStyle = "rgba(220,226,255,.78)";
  rows.forEach((row, index) => {
    const x = pad + index * step + step / 2;
    ctx.fillText(row.month.slice(5), x - 7, height - 10);
  });
  ctx.fillStyle = "rgba(220,226,255,.9)";
  ctx.fillText("RM1m monthly target", pad, Math.max(12, targetY - 6));
  ctx.fillStyle = "#24e7ff";
  ctx.fillText("Cumulative climb", width - pad - 104, chartTop + 13);

  const totalSales = rows.reduce((sum, row) => sum + row.sales, 0);
  const progress = yearlyTarget ? Math.min(100, (totalSales / yearlyTarget) * 100) : 0;
  const currentMonth = `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const currentMonthSales = rows.find((row) => row.month === currentMonth)?.sales || 0;
  const restMonthly = Math.max(0, monthlyTarget - currentMonthSales);
  els.targetSummary.innerHTML = `
    <div><span>2026 Sales</span><strong>${currency.format(totalSales)}</strong></div>
    <div><span>Year Progress</span><strong>${progress.toFixed(1)}%</strong></div>
    <div><span>Rest Monthly</span><strong>${currency.format(restMonthly)}</strong></div>
  `;
}

function renderTrend() {
  const canvas = document.querySelector("#trendChart");
  const ctx = setupCanvas(canvas);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);
  const trend = salespersonTrendRows();
  renderTrendSummary(trend);
  const hasData = trend.series.some((series) => series.rows.some((row) => row.sales));
  if (!hasData) return drawEmpty(ctx, width, height);

  const pad = 32;
  const legendTop = 16;
  const chartTop = 30;
  const max = Math.max(...trend.series.flatMap((series) => series.rows.map((row) => row.sales)), 1);
  const labelCount = trend.labels.length;

  ctx.strokeStyle = "#d9dee6";
  ctx.beginPath();
  ctx.moveTo(pad, chartTop);
  ctx.lineTo(pad, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.stroke();

  ctx.font = "12px Segoe UI";
  trend.series.forEach((series, seriesIndex) => {
    const points = series.rows.map((row, index) => ({
      x: pad + (index * (width - pad * 2)) / Math.max(labelCount - 1, 1),
      y: height - pad - (row.sales / max) * (height - pad - chartTop),
      row,
    }));
    drawLine(ctx, points, "y", series.color);
    ctx.fillStyle = series.color;
    const legendX = pad + seriesIndex * 74;
    if (legendX < width - 70) {
      ctx.fillRect(legendX, legendTop - 9, 14, 3);
      ctx.fillText(series.name.slice(0, 8), legendX + 18, legendTop - 4);
    }
  });

  ctx.fillStyle = "#475569";
  trend.labels.forEach((label, index) => {
    const x = pad + (index * (width - pad * 2)) / Math.max(labelCount - 1, 1);
    if (trend.labels.length > 14 && index % Math.ceil(trend.labels.length / 10) !== 0) return;
    ctx.fillText(label.slice(5), x - 14, height - 10);
  });
}

function renderTrendSummary(trend) {
  if (!els.trendSummary) return;
  els.trendSummary.innerHTML = trend.series
    .map((series) => {
      const sales = series.rows.reduce((sum, row) => sum + Number(row.sales || 0), 0);
      const invoices = series.rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
      return `
        <div class="trend-person-summary" style="--person-color:${series.color}">
          <span>${escapeHtml(series.name)}</span>
          <strong>${currency.format(sales)}</strong>
          <small>${invoices} invoices</small>
        </div>`;
    })
    .join("");
}

function salespersonTrendRows() {
  const filters = getFilters();
  const labels = trendDateLabels(filters);
  const palette = ["#39aee2", "#3f1957", "#12b99f", "#f59e0b", "#e4568f", "#6366f1", "#64748b"];
  const selectedPeople = filters.salesperson === "All" ? getSalespeople() : getSalespeople().filter((name) => name === filters.salesperson);
  const series = selectedPeople.map((name, index) => ({
    name,
    color: palette[index % palette.length],
    rows: labels.map((date) => {
      const invoices = state.invoices.filter(
        (invoice) => !invoice.trashedAt && invoice.salesperson === name && invoice.date === date && trendInvoiceMatches(invoice, { ...filters, salesperson: name }),
      );
      return {
        date,
        sales: invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
        count: invoices.length,
      };
    }),
  }));
  return { labels, series };
}

function trendDateLabels(filters) {
  const today = new Date().toISOString().slice(0, 10);
  const dates = [filters.dateFrom, filters.dateTo].filter(Boolean).sort();
  const from = dates[0] || today;
  const to = dates[1] || from;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const labels = [];
  for (let date = new Date(start); date <= end && labels.length < 62; date.setDate(date.getDate() + 1)) {
    labels.push(date.toISOString().slice(0, 10));
  }
  return labels;
}

function trendInvoiceMatches(invoice, filters) {
  if (filters.salesperson !== "All" && invoice.salesperson !== filters.salesperson) return false;
  if (!filters.search) return true;
  const costDocs = invoiceCosts(invoice.id).map((cost) => cost.docNo).join(" ");
  const searchable = `${invoice.invoiceNo} ${invoice.customer} ${invoice.salesperson} ${costDocs}`.toLowerCase();
  return searchable.includes(filters.search);
}

function trendCostMatches(cost, filters) {
  const invoice = findInvoice(cost.invoiceId);
  const owner = costOwner(cost, invoice);
  if (filters.salesperson !== "All" && owner !== filters.salesperson) return false;
  if (!filters.search) return true;
  const searchable = `${cost.docNo} ${cost.type} ${cost.note} ${cost.linkedInvoiceNo || ""} ${invoice?.invoiceNo || ""} ${owner}`.toLowerCase();
  return searchable.includes(filters.search);
}

function drawLine(ctx, points, yKey, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  points.forEach((point, index) => (index ? ctx.lineTo(point.x, point[yKey]) : ctx.moveTo(point.x, point[yKey])));
  ctx.stroke();
  ctx.fillStyle = color;
  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point[yKey], 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderLatestInvoices(costs) {
  const rows = costs
    .filter((cost) => costOwner(cost) === "Unlinked")
    .sort((a, b) => {
      const byDate = String(b.date || "").localeCompare(String(a.date || ""));
      if (byDate) return byDate;
      return String(a.docNo || "").localeCompare(String(b.docNo || ""), undefined, { numeric: true, sensitivity: "base" });
    })
    .slice(0, 8);
  els.latestInvoices.innerHTML = rows.length ? rows.map((cost) => `
      <div class="linked-row">
        <div><strong>${escapeHtml(cost.docNo)}</strong><br><small>${escapeHtml(cost.type)} - ${escapeHtml(costLinkLabel(cost))} - ${escapeHtml(cost.date || "")}</small></div>
        <strong>${currency.format(cost.amount || 0)}</strong>
      </div>`).join("") : `<p class="empty">No unlinked costs for this filter.</p>`;
}

function renderInvoiceTable(invoices) {
  const t = totals(invoices);
  els.invoiceSummary.textContent = `${invoices.length} invoices · ${currency.format(t.sales)} sales · ${currency.format(t.agentOrder)} agent sales · ${currency.format(t.outstanding)} outstanding · ${currency.format(t.profit)} profit`;
  document.querySelectorAll("[data-invoice-sort]").forEach((button) => {
    const key = button.dataset.invoiceSort;
    button.classList.toggle("active", invoiceLedgerSort === key || invoiceLedgerSort === `${key}-desc`);
    button.dataset.sortDirection = invoiceLedgerSort === `${key}-desc` ? "desc" : "asc";
  });
  els.invoiceBody.innerHTML = sortedInvoiceLedgerRows(invoices)
    .map((invoice) => {
      const costs = invoiceCosts(invoice.id);
      const signFutureCost = invoiceCostTypeTotal(invoice, "Sign Future");
      const printingCost = invoiceCostTypeTotal(invoice, "S&Y Printing");
      const lalamoveCost = invoiceCostTypeTotal(invoice, "Lalamove");
      const purchaseCost = invoiceCostTypeTotal(invoice, "Purchase");
      const costDocs = invoiceCostDocsButton(invoice.id, costs);
      const paymentStatusClass = invoiceRowStatusClass(invoice);
      return `
        <tr class="${paymentStatusClass}">
          <td class="select-col"><input class="invoice-select" type="checkbox" value="${invoice.id}" /></td>
          <td><strong>${escapeHtml(invoice.invoiceNo)}</strong></td>
          <td>${escapeHtml(invoice.date)}</td>
          <td>${escapeHtml(invoice.salesperson)}</td>
          <td>${escapeHtml(invoice.customer || "")}</td>
          <td class="num">${currency.format(invoice.amount)}</td>
          <td class="num">${currency.format(invoice.agentOrder || 0)}</td>
          ${costValueCell(signFutureCost)}
          ${costValueCell(printingCost)}
          ${costValueCell(lalamoveCost)}
          ${costValueCell(purchaseCost)}
          <td class="num">${currency.format(invoice.outstanding || 0)}</td>
          <td class="num profit ${invoiceProfit(invoice) < 0 ? "negative" : ""}">${currency.format(invoiceProfit(invoice))}</td>
          <td class="num">${invoiceMargin(invoice).toFixed(1)}%</td>
          <td>${costDocs}</td>
          <td class="installation-cell">${invoiceInstallationCompletionBadge(invoice)}</td>
          <td class="complete-tick-cell">
            <div class="complete-tick-control">
              <label class="status-check" title="Profit settled">
                <input type="checkbox" ${invoice.settled ? "checked" : ""} onchange="toggleInvoiceSettled('${invoice.id}', this.checked)" />
                <span>&#10003;</span>
              </label>
            </div>
            ${invoice.settled && invoice.settledAt ? `<span class="tick-date-label" title="Tick date ${escapeHtml(invoice.settledAt)}">${escapeHtml(formatTickDate(invoice.settledAt))}</span>` : ""}
          </td>
          <td class="table-actions">
            <button type="button" onclick="editInvoice('${invoice.id}')">Edit</button>
            <button type="button" onclick="startCostForInvoice('${invoice.id}')">Cost</button>
            <button type="button" onclick="deleteInvoice('${invoice.id}')">Delete</button>
          </td>
        </tr>`;
    })
    .join("");
}

function invoiceInstallationCompletionBadge(invoice) {
  if (invoice.jobType !== "installation") return "";
  const completed = Boolean(invoice.installation?.completed);
  const title = completed ? "Installation completed" : "Installation pending";
  return `
    <span class="installation-complete-record ${completed ? "completed" : "pending"}" title="${title}">
      <span aria-hidden="true">🚚</span>
      <strong>${completed ? "Done" : "Install"}</strong>
    </span>
  `;
}

function invoiceCostDocsButton(invoiceId, costs = invoiceCosts(invoiceId)) {
  if (!costs.length) return `<button class="cost-docs-button empty" type="button" disabled title="No costs linked">No cost</button>`;
  const label = costs.length === 1 ? "1 linked" : `${costs.length} linked`;
  return `
    <button class="cost-docs-button" type="button" onclick="showInvoiceCostDocs('${escapeHtml(invoiceId)}')" title="Show linked cost docs">
      <span aria-hidden="true">Docs</span>
      <strong>${escapeHtml(label)}</strong>
    </button>`;
}

window.showInvoiceCostDocs = function showInvoiceCostDocs(invoiceId) {
  const invoice = findInvoice(invoiceId);
  if (!invoice || !els.scorecardDetailDialog) return;
  const costs = invoiceCosts(invoiceId);
  els.scorecardDetailTitle.textContent = `Linked Cost Docs - ${invoice.invoiceNo}`;
  els.scorecardDetailSummary.textContent = costs.length
    ? `${costs.length} linked cost docs - ${currency.format(costs.reduce((sum, cost) => sum + Number(cost.amount || 0), 0))}`
    : "No linked cost docs.";
  els.scorecardDetailBody.innerHTML = renderScorecardDetailRows(costs, "cost");
  openScorecardDetailDialog();
};

function sortedInvoiceLedgerRows(invoices) {
  return [...invoices].sort((a, b) => {
    if (invoiceLedgerSort === "invoice") {
      return String(a.invoiceNo || "").localeCompare(String(b.invoiceNo || ""), undefined, { numeric: true, sensitivity: "base" });
    }
    if (invoiceLedgerSort === "invoice-desc") {
      return String(b.invoiceNo || "").localeCompare(String(a.invoiceNo || ""), undefined, { numeric: true, sensitivity: "base" });
    }
    if (invoiceLedgerSort === "date") {
      return String(a.date || "").localeCompare(String(b.date || "")) || String(a.invoiceNo || "").localeCompare(String(b.invoiceNo || ""), undefined, { numeric: true, sensitivity: "base" });
    }
    return String(b.date || "").localeCompare(String(a.date || "")) || String(b.invoiceNo || "").localeCompare(String(a.invoiceNo || ""), undefined, { numeric: true, sensitivity: "base" });
  });
}

function renderCostTable(costs) {
  document.querySelectorAll(".cost-type-filter-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.costType === costTypeFilter);
  });
  const total = costs.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
  const typeLabel = costTypeFilter === "All" ? "All types" : costTypeFilter;
  els.costSummary.innerHTML = `
    <span>${escapeHtml(typeLabel)} · ${costs.length} cost bills</span>
    <span>${currency.format(total)} linked cost</span>
  `;
  document.querySelectorAll("[data-cost-sort]").forEach((button) => {
    button.classList.toggle("active", costLedgerSort === "date" || costLedgerSort === "date-desc");
    button.dataset.sortDirection = costLedgerSort === "date" ? "asc" : "desc";
  });
  els.costBody.innerHTML = sortedCostLedgerRows(costs)
    .map((cost) => {
      const invoice = linkedInvoiceForCost(cost);
      const linkedLabel = costLinkLabel(cost, invoice);
      const owner = costOwner(cost, invoice);
      const rowStatusClass = costRowStatusClass(cost, invoice);
      const statusChecked = costStatusChecked(cost, invoice);
      const tickDate = cost.lateCost ? cost.lateCostAt : costIncludedWithInvoiceSettlement(cost, invoice) ? invoice?.settledAt : "";
      return `
        <tr class="${rowStatusClass}">
          <td class="select-col"><input class="cost-select" type="checkbox" value="${cost.id}" /></td>
          <td><strong>${escapeHtml(cost.docNo)}</strong></td>
          <td>${escapeHtml(cost.type)}</td>
          <td>${escapeHtml(cost.date)}</td>
          <td>${escapeHtml(linkedLabel)}</td>
          <td>${escapeHtml(owner)}</td>
          <td class="num">${currency.format(cost.amount)}</td>
          <td>${escapeHtml(cost.note || "")}</td>
          <td class="table-actions">
            <label class="status-check late-cost-check" title="${invoice?.settled ? "Recorded from settled invoice" : "Late cost for Sales Scorecard"}">
              <input type="checkbox" ${statusChecked ? "checked" : ""} onchange="toggleCostLate('${cost.id}', this.checked)" />
              <span>&#10003;</span>
            </label>
            ${statusChecked && tickDate ? `<span class="tick-date-label" title="Tick date ${escapeHtml(tickDate)}">${escapeHtml(formatTickDate(tickDate))}</span>` : ""}
            <button type="button" onclick="editCost('${cost.id}')">Edit</button>
            <button type="button" onclick="deleteCost('${cost.id}')">Delete</button>
          </td>
        </tr>`;
    })
    .join("");
}

function sortedCostLedgerRows(costs) {
  return [...costs].sort((a, b) => {
    if (costLedgerSort === "date") {
      return String(a.date || "").localeCompare(String(b.date || "")) || String(a.docNo || "").localeCompare(String(b.docNo || ""), undefined, { numeric: true, sensitivity: "base" });
    }
    return String(b.date || "").localeCompare(String(a.date || "")) || String(a.docNo || "").localeCompare(String(b.docNo || ""), undefined, { numeric: true, sensitivity: "base" });
  });
}

function renderTrashTable(invoices, costs) {
  const invoiceTotal = totals(invoices);
  const costTotal = costs.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
  els.trashSummary.textContent = `${invoices.length} invoices · ${costs.length} costs · ${currency.format(invoiceTotal.sales)} sales · ${currency.format(costTotal)} cost`;
  const invoiceRows = invoices.map((invoice) => ({
    type: "Invoice",
    no: invoice.invoiceNo,
    date: invoice.date,
    salesperson: invoice.salesperson,
    details: invoice.customer || "",
    amount: invoice.amount,
    trashedAt: invoice.trashedAt,
  }));
  const costRows = costs.map((cost) => {
    const invoice = findInvoice(cost.invoiceId);
    return {
      type: "Cost",
      no: cost.docNo,
      date: cost.date,
      salesperson: costOwner(cost, invoice),
      details: `${cost.type} · ${costLinkLabel(cost, invoice)}`,
      amount: cost.amount,
      trashedAt: cost.trashedAt,
    };
  });
  els.trashBody.innerHTML = [...invoiceRows, ...costRows]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.type)}</td>
          <td><strong>${escapeHtml(row.no)}</strong></td>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.salesperson)}</td>
          <td>${escapeHtml(row.details)}</td>
          <td class="num">${currency.format(row.amount)}</td>
          <td>${escapeHtml(row.trashedAt || "")}</td>
        </tr>`,
    )
    .join("");
}

function renderEmptyStates(invoices, costs, trashInvoices, trashCosts, facebookRows = []) {
  const hasAnyData = state.invoices.length || state.costs.length || state.facebookListings.length;
  els.emptyHero.classList.toggle("active", !hasAnyData && activeView === "dashboard");
  els.invoiceEmpty.classList.toggle("active", !invoices.length);
  els.costEmpty.classList.toggle("active", !costs.length);
  els.facebookEmpty?.classList.toggle("active", !facebookRows.length);
  els.trashEmpty.classList.toggle("active", !trashInvoices.length && !trashCosts.length);
  document.querySelector("#invoicesView .table-wrap").classList.toggle("is-empty", !invoices.length);
  document.querySelector("#costsView .table-wrap").classList.toggle("is-empty", !costs.length);
  document.querySelector("#facebookView .table-wrap")?.classList.toggle("is-empty", !facebookRows.length);
  document.querySelector("#trashView .table-wrap").classList.toggle("is-empty", !trashInvoices.length && !trashCosts.length);
}

function refreshInvoiceOptions() {
  const selected = els.linkedInvoice.value;
  const invoices = [...state.invoices].sort((a, b) => b.date.localeCompare(a.date) || a.invoiceNo.localeCompare(b.invoiceNo));
  els.linkedInvoice.innerHTML = invoices.map((invoice) => {
    const label = `${invoice.invoiceNo} · ${invoice.salesperson} · ${currency.format(invoice.amount)}`;
    return `<option value="${invoice.id}">${escapeHtml(label)}</option>`;
  }).join("");
  if (invoices.some((invoice) => invoice.id === selected)) els.linkedInvoice.value = selected;
}

function renderLinkedPreview() {
  const invoice = findInvoice(els.linkedInvoice.value);
  if (!invoice) {
    els.linkedPreview.innerHTML = `<span>No invoice selected yet.</span>`;
    return;
  }
  const costTotal = invoiceCostTotal(invoice.id);
  const newCost = Number(document.querySelector("#costAmount").value || 0);
  const editingId = document.querySelector("#costId").value;
  const currentCost = state.costs.find((cost) => cost.id === editingId);
  const adjustedCost = costTotal - Number(currentCost?.amount || 0) + newCost;
  const profit = Number(invoice.amount || 0) - adjustedCost;
  els.linkedPreview.innerHTML = `
    <span>Invoice <strong>${escapeHtml(invoice.invoiceNo)}</strong></span>
    <span>Sales <strong>${currency.format(invoice.amount)}</strong></span>
    <span>After Cost <strong>${currency.format(adjustedCost)}</strong></span>
    <span>Profit <strong>${currency.format(profit)}</strong></span>
  `;
}

function selectedInvoiceJobType() {
  return els.invoiceJobType?.value || "supply";
}

function updateInvoiceJobTypeFields() {
  const isInstallation = selectedInvoiceJobType() === "installation";
  els.invoiceInstallationFields?.classList.toggle("hidden", !isInstallation);
  [els.installationAddress, els.installationPostcode, els.installationDate, els.installationStartTime, els.installationEndTime].forEach((input) => {
    if (input) input.required = isInstallation;
  });
}

function updateInstallationLocationFromPostcode() {
  if (!els.installationPostcode) return;
  els.installationPostcode.value = els.installationPostcode.value.replace(/\D/g, "").slice(0, 5);
  const location = malaysiaPostcodeLocation(els.installationPostcode.value);
  if (els.installationState) els.installationState.value = location.state;
}

function setInvoiceJobType(type) {
  const value = type === "installation" ? "installation" : "supply";
  if (els.invoiceJobType) els.invoiceJobType.value = value;
  updateInvoiceJobTypeFields();
}

function halfHourTime(value) {
  if (!value) return "";
  const [hourPart, minutePart = "0"] = value.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  let roundedMinute = minute < 15 ? 0 : minute < 45 ? 30 : 0;
  let roundedHour = hour + (minute >= 45 ? 1 : 0);
  if (roundedHour >= 24) {
    roundedHour = 23;
    roundedMinute = 30;
  }
  return `${String(roundedHour).padStart(2, "0")}:${String(roundedMinute).padStart(2, "0")}`;
}

function normalizeTimeInputToHalfHour(input) {
  if (!input?.value) return;
  input.value = halfHourTime(input.value);
}

function saveInvoice(event) {
  event.preventDefault();
  const id = document.querySelector("#invoiceId").value || createId();
  const previous = state.invoices.find((row) => row.id === id);
  const jobType = selectedInvoiceJobType();
  updateInstallationLocationFromPostcode();
  normalizeTimeInputToHalfHour(els.installationStartTime);
  normalizeTimeInputToHalfHour(els.installationEndTime);
  const invoice = {
    ...(previous || {}),
    id,
    invoiceNo: document.querySelector("#invoiceNo").value.trim().toUpperCase(),
    date: document.querySelector("#invoiceDate").value,
    salesperson: document.querySelector("#invoiceSalesperson").value,
    amount: Number(document.querySelector("#invoiceAmount").value || 0),
    agentOrder: Number(document.querySelector("#invoiceAgentOrder").value || 0),
    outstanding: Number(document.querySelector("#invoiceOutstanding").value || 0),
    customer: document.querySelector("#invoiceCustomer").value.trim(),
    note: document.querySelector("#invoiceNote").value.trim(),
    jobType,
    installation: jobType === "installation"
      ? {
          ...(previous?.installation || {}),
          address: cleanText(els.installationAddress?.value),
          postcode: cleanText(els.installationPostcode?.value),
          state: cleanText(els.installationState?.value),
          date: els.installationDate?.value || "",
          startTime: els.installationStartTime?.value || "",
          endTime: els.installationEndTime?.value || "",
          completed: Boolean(previous?.installation?.completed),
          completedAt: previous?.installation?.completedAt || "",
        }
      : normalizeInstallation({}, "supply"),
    settled: Boolean(previous?.settled),
    settledAt: previous?.settledAt || "",
    trashedAt: previous?.trashedAt || "",
  };
  const existing = state.invoices.findIndex((row) => row.id === id);
  if (existing >= 0) state.invoices[existing] = invoice;
  else state.invoices.push(invoice);
  persist();
  clearInvoiceForm();
  refreshInvoiceOptions();
  switchView(jobType === "installation" ? "installation" : "invoices");
}

function saveCost(event) {
  event.preventDefault();
  const id = document.querySelector("#costId").value || createId();
  const previous = state.costs.find((row) => row.id === id);
  const cost = {
    ...(previous || {}),
    id,
    invoiceId: els.linkedInvoice.value,
    linkedInvoiceNo: findInvoice(els.linkedInvoice.value)?.invoiceNo || "",
    owner: "",
    type: document.querySelector("#costType").value,
    docNo: document.querySelector("#costDocNo").value.trim().toUpperCase(),
    amount: Number(document.querySelector("#costAmount").value || 0),
    date: document.querySelector("#costDate").value,
    note: document.querySelector("#costNote").value.trim(),
    lateCost: Boolean(previous?.lateCost),
    lateCostAt: previous?.lateCostAt || "",
    trashedAt: previous?.trashedAt || "",
  };
  const existing = state.costs.findIndex((row) => row.id === id);
  if (existing >= 0) state.costs[existing] = cost;
  else state.costs.push(cost);
  persist();
  clearCostForm();
  switchView("costs");
}

window.toggleInvoiceSettled = async function toggleInvoiceSettled(id, checked) {
  const invoice = findInvoice(id);
  if (!invoice) return;
  if (!checked) {
    if (!confirm(`Are you sure you want to remove the tick for ${invoice.invoiceNo}?`)) {
      render();
      return;
    }
    invoice.settled = false;
    invoice.settledAt = "";
    persist();
    render();
    return;
  }
  const tickDate = await requestTickDate(`Choose the tick date for ${invoice.invoiceNo}.`, invoice.settledAt || todayInputValue());
  if (!tickDate) {
    render();
    return;
  }
  invoice.settled = checked;
  invoice.settledAt = tickDate;
  persist();
  render();
};

window.toggleCostLate = async function toggleCostLate(id, checked) {
  const cost = state.costs.find((row) => row.id === id);
  if (!cost) return;
  const invoice = linkedInvoiceForCost(cost);
  if (!checked && invoice?.settled && !cost.lateCost) {
    alert("This tick follows the linked invoice settlement. Untick the invoice first if you want to remove it.");
    render();
    return;
  }
  if (!checked) {
    if (!confirm(`Are you sure you want to remove the late cost tick for ${cost.docNo}?`)) {
      render();
      return;
    }
    cost.lateCost = false;
    cost.lateCostAt = "";
    persist();
    render();
    return;
  }
  const tickDate = await requestTickDate(`Choose the late cost tick date for ${cost.docNo}.`, cost.lateCostAt || todayInputValue());
  if (!tickDate) {
    render();
    return;
  }
  cost.lateCost = true;
  cost.lateCostAt = tickDate;
  persist();
  render();
};

window.editInvoice = function editInvoice(id) {
  const invoice = findInvoice(id);
  if (!invoice) return;
  showInvoiceOnlyEntry();
  document.querySelector("#invoiceId").value = invoice.id;
  document.querySelector("#invoiceNo").value = invoice.invoiceNo;
  document.querySelector("#invoiceDate").value = invoice.date;
  document.querySelector("#invoiceSalesperson").value = invoice.salesperson;
  document.querySelector("#invoiceAmount").value = invoice.amount;
  document.querySelector("#invoiceAgentOrder").value = invoice.agentOrder || 0;
  document.querySelector("#invoiceOutstanding").value = invoice.outstanding || 0;
  document.querySelector("#invoiceCustomer").value = invoice.customer || "";
  document.querySelector("#invoiceNote").value = invoice.note || "";
  setInvoiceJobType(invoice.jobType || "supply");
  els.installationAddress.value = invoice.installation?.address || "";
  els.installationPostcode.value = invoice.installation?.postcode || "";
  els.installationState.value = invoice.installation?.state || "";
  els.installationDate.value = invoice.installation?.date || "";
  els.installationStartTime.value = invoice.installation?.startTime || "";
  els.installationEndTime.value = invoice.installation?.endTime || "";
  els.invoiceModeLabel.textContent = `Editing ${invoice.invoiceNo}`;
  switchView("entry");
};

window.startCostForInvoice = function startCostForInvoice(id) {
  showCostOnlyEntry();
  clearCostForm();
  els.linkedInvoice.value = id;
  renderLinkedPreview();
  switchView("entry");
  document.querySelector("#costDocNo").focus();
};

window.editCost = function editCost(id) {
  const cost = state.costs.find((row) => row.id === id);
  if (!cost) return;
  showFullEntry();
  document.querySelector("#costId").value = cost.id;
  document.querySelector("#costType").value = cost.type;
  document.querySelector("#costDocNo").value = cost.docNo;
  document.querySelector("#costAmount").value = cost.amount;
  document.querySelector("#costDate").value = cost.date;
  document.querySelector("#costNote").value = cost.note || "";
  els.linkedInvoice.value = cost.invoiceId;
  els.costModeLabel.textContent = `Editing ${cost.docNo}`;
  renderLinkedPreview();
  switchView("entry");
};

window.deleteInvoice = function deleteInvoice(id) {
  const invoice = findInvoice(id);
  if (!invoice) return;
  if (!confirm(`Move ${invoice.invoiceNo} to trash?`)) return;
  invoice.trashedAt = new Date().toISOString().slice(0, 10);
  persist();
  render();
};

function selectedValues(selector) {
  return [...document.querySelectorAll(`${selector}:checked`)].map((input) => input.value);
}

function selectAllVisibleInvoices() {
  if (!selectionMode.invoices) {
    selectionMode.invoices = true;
    render();
  }
  document.querySelectorAll(".invoice-select").forEach((input) => {
    input.checked = true;
  });
}

function selectAllVisibleCosts() {
  if (!selectionMode.costs) {
    selectionMode.costs = true;
    render();
  }
  document.querySelectorAll(".cost-select").forEach((input) => {
    input.checked = true;
  });
}

function cancelInvoiceSelection() {
  selectionMode.invoices = false;
  document.querySelectorAll(".invoice-select").forEach((input) => {
    input.checked = false;
  });
  render();
}

function cancelCostSelection() {
  selectionMode.costs = false;
  document.querySelectorAll(".cost-select").forEach((input) => {
    input.checked = false;
  });
  render();
}

function moveSelectedInvoicesToTrash() {
  if (!selectionMode.invoices) {
    selectionMode.invoices = true;
    render();
    return;
  }
  const ids = selectedValues(".invoice-select");
  if (!ids.length) {
    alert("Please select at least one invoice.");
    return;
  }
  if (!confirm(`Move ${ids.length} selected invoices to trash?`)) return;
  const trashedAt = new Date().toISOString().slice(0, 10);
  state.invoices.forEach((invoice) => {
    if (ids.includes(invoice.id)) invoice.trashedAt = trashedAt;
  });
  selectionMode.invoices = false;
  persist();
  switchView("trash");
}

function moveSelectedCostsToTrash() {
  if (!selectionMode.costs) {
    selectionMode.costs = true;
    render();
    return;
  }
  const ids = selectedValues(".cost-select");
  if (!ids.length) {
    alert("Please select at least one cost bill.");
    return;
  }
  if (!confirm(`Move ${ids.length} selected cost bills to trash?`)) return;
  const trashedAt = new Date().toISOString().slice(0, 10);
  state.costs.forEach((cost) => {
    if (ids.includes(cost.id)) cost.trashedAt = trashedAt;
  });
  selectionMode.costs = false;
  persist();
  switchView("trash");
}

function moveSelectedMonthToTrash() {
  const month = selectedFilterMonth();
  if (!month) {
    alert("Please select a month first.");
    return;
  }
  const invoices = getFilteredInvoices().filter((invoice) => invoice.date.startsWith(month));
  if (!invoices.length) {
    alert(`No active invoices found for ${month}.`);
    return;
  }
  if (!confirm(`Move ${invoices.length} active invoices for ${month} to trash?\n\nYou can restore or permanently delete them from Trash.`)) return;
  const trashedAt = new Date().toISOString().slice(0, 10);
  invoices.forEach((invoice) => {
    invoice.trashedAt = trashedAt;
  });
  selectionMode.invoices = false;
  persist();
  switchView("trash");
}

function moveSelectedMonthCostsToTrash() {
  const month = selectedFilterMonth();
  if (!month) {
    alert("Please select a month first.");
    return;
  }
  const costs = getFilteredCosts().filter((cost) => cost.date.startsWith(month));
  if (!costs.length) {
    alert(`No active cost bills found for ${month}.`);
    return;
  }
  if (!confirm(`Move ${costs.length} active cost bills for ${month} to trash?\n\nYou can restore or permanently delete them from Trash.`)) return;
  const trashedAt = new Date().toISOString().slice(0, 10);
  costs.forEach((cost) => {
    cost.trashedAt = trashedAt;
  });
  selectionMode.costs = false;
  persist();
  switchView("trash");
}

function restoreSelectedTrashMonth() {
  const month = selectedFilterMonth();
  const invoices = getFilteredTrashInvoices().filter((invoice) => invoice.date.startsWith(month));
  const costs = getFilteredTrashCosts().filter((cost) => cost.date.startsWith(month));
  if (!invoices.length && !costs.length) {
    alert(`No trashed invoices or costs found for ${month}.`);
    return;
  }
  if (!confirm(`Restore ${invoices.length} invoices and ${costs.length} costs for ${month} from trash?`)) return;
  invoices.forEach((invoice) => {
    invoice.trashedAt = "";
  });
  costs.forEach((cost) => {
    cost.trashedAt = "";
  });
  persist();
  switchView("invoices");
}

function deleteSelectedTrashMonthForever() {
  const month = selectedFilterMonth();
  const invoices = getFilteredTrashInvoices().filter((invoice) => invoice.date.startsWith(month));
  const costs = getFilteredTrashCosts().filter((cost) => cost.date.startsWith(month));
  if (!invoices.length && !costs.length) {
    alert(`No trashed invoices or costs found for ${month}.`);
    return;
  }
  if (!confirm(`Permanently delete ${invoices.length} invoices and ${costs.length} costs for ${month}?\n\nThis cannot be undone.`)) return;
  const ids = new Set(invoices.map((invoice) => invoice.id));
  state.invoices = state.invoices.filter((invoice) => !ids.has(invoice.id));
  const costIds = new Set(costs.map((cost) => cost.id));
  state.costs = state.costs.filter((cost) => !ids.has(cost.invoiceId) && !costIds.has(cost.id));
  persist();
  render();
}

window.deleteCost = function deleteCost(id) {
  const cost = state.costs.find((row) => row.id === id);
  if (!cost) return;
  if (!confirm(`Move cost bill ${cost.docNo} to trash?`)) return;
  cost.trashedAt = new Date().toISOString().slice(0, 10);
  persist();
  render();
};

function clearInvoiceForm() {
  els.invoiceForm.reset();
  document.querySelector("#invoiceId").value = "";
  els.invoiceModeLabel.textContent = "Create invoice first, then link cost bills to it";
  setDefaultDates();
  setInvoiceJobType("supply");
  if (els.installationAddress) els.installationAddress.value = "";
  if (els.installationPostcode) els.installationPostcode.value = "";
  if (els.installationState) els.installationState.value = "";
  if (els.installationDate) els.installationDate.value = "";
  if (els.installationStartTime) els.installationStartTime.value = "";
  if (els.installationEndTime) els.installationEndTime.value = "";
}

function clearCostForm() {
  els.costForm.reset();
  document.querySelector("#costId").value = "";
  els.costModeLabel.textContent = "Record each supplier bill and connect it to an invoice";
  setDefaultDates();
  refreshInvoiceOptions();
  renderLinkedPreview();
}

function exportCsv() {
  const headers = ["Invoice", "Date", "Salesperson", "Customer", "Sales", "Agent Sales", "Sign Future Cost", "S&Y Printing Cost", "Lalamove Cost", "Purchase Cost", "Outstanding", "Profit", "Margin", "Cost Docs", "Installation", "Complete Tick"];
  const rows = getFilteredInvoices().map((invoice) => [
    invoice.invoiceNo,
    invoice.date,
    invoice.salesperson,
    invoice.customer || "",
    invoice.amount,
    invoice.agentOrder || 0,
    invoiceCostTypeTotal(invoice, "Sign Future"),
    invoiceCostTypeTotal(invoice, "S&Y Printing"),
    invoiceCostTypeTotal(invoice, "Lalamove"),
    invoiceCostTypeTotal(invoice, "Purchase"),
    invoice.outstanding || 0,
    invoiceProfit(invoice),
    `${invoiceMargin(invoice).toFixed(1)}%`,
    invoiceCosts(invoice.id).map((cost) => `${cost.type}:${cost.docNo}:${cost.amount}`).join(" | "),
    invoice.jobType === "installation" ? (invoice.installation?.completed ? "Done" : "Install") : "",
    invoice.settled ? "Yes" : "No",
  ]);
  download(`sales-performance-${els.dateFromFilter.value || els.dateToFilter.value || "all"}.csv`, [headers, ...rows].map(csvRow).join("\n"), "text/csv");
}

function exportJson() {
  const json = JSON.stringify(state, null, 2);
  const ok = download("sales-performance-backup.json", json, "application/json");
  if (els.importStatus) {
    els.importStatus.textContent = ok
      ? "Backup JSON opened below. Copy it if the download does not appear."
      : "Backup failed. Please try another browser or allow downloads for localhost.";
  }
  openBackupJsonDialog(json);
}

function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state = normalizeState(JSON.parse(reader.result));
    persist();
    setDefaultMonth();
    refreshInvoiceOptions();
    render();
  };
  reader.readAsText(file);
}

function openBackupJsonDialog(json) {
  if (!els.jsonTransferDialog) {
    prompt("Copy this backup JSON:", json);
    return;
  }
  els.jsonTransferTitle.textContent = "Backup JSON";
  els.jsonTransferMessage.textContent = "Copy this JSON, then open the same link in another browser and use Paste JSON.";
  els.jsonTransferText.value = json;
  els.jsonTransferText.readOnly = true;
  els.jsonCopyButton.hidden = false;
  els.jsonRestoreButton.hidden = true;
  openJsonTransferDialog();
  els.jsonTransferText.focus();
  els.jsonTransferText.select();
}

function openPasteJsonDialog() {
  if (!els.jsonTransferDialog) {
    const json = prompt("Paste backup JSON here:");
    if (json) restoreJsonText(json);
    return;
  }
  els.jsonTransferTitle.textContent = "Paste JSON";
  els.jsonTransferMessage.textContent = "Paste the backup JSON from your other browser, then restore it here.";
  els.jsonTransferText.value = "";
  els.jsonTransferText.readOnly = false;
  els.jsonCopyButton.hidden = true;
  els.jsonRestoreButton.hidden = false;
  openJsonTransferDialog();
  els.jsonTransferText.focus();
}

function openJsonTransferDialog() {
  if (els.jsonTransferDialog.open) els.jsonTransferDialog.close();
  if (typeof els.jsonTransferDialog.showModal === "function") {
    els.jsonTransferDialog.showModal();
  } else {
    els.jsonTransferDialog.setAttribute("open", "");
  }
}

function closeJsonTransferDialog() {
  if (els.jsonTransferDialog?.open) els.jsonTransferDialog.close();
}

async function copyJsonFromDialog() {
  const text = els.jsonTransferText.value;
  try {
    await navigator.clipboard.writeText(text);
    els.jsonTransferMessage.textContent = "Copied. Open the same link in another browser, then use Paste JSON.";
  } catch {
    els.jsonTransferText.focus();
    els.jsonTransferText.select();
    els.jsonTransferMessage.textContent = "Press Ctrl + C to copy the selected JSON.";
  }
}

function restoreJsonFromDialog() {
  restoreJsonText(els.jsonTransferText.value);
}

function restoreJsonText(text) {
  try {
    state = normalizeState(JSON.parse(text));
    persist();
    setDefaultMonth();
    refreshInvoiceOptions();
    render();
    closeJsonTransferDialog();
    if (els.importStatus) els.importStatus.textContent = "JSON restored successfully.";
  } catch {
    if (els.jsonTransferMessage) els.jsonTransferMessage.textContent = "Restore failed. Paste the full backup JSON and try again.";
  }
}

async function importInvoiceReport(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const importType = els.importType.value;
    const isInvoiceUpload = importType === "invoice";
    const forcedCostType = importType.startsWith("cost:") ? importType.slice(5) : "";
    const detectedSalesperson = detectSalesperson(file.name);
    const defaultSalesperson = detectedSalesperson || els.importSalesperson.value;
    const selectedMonth = selectedImportMonth();
    if (detectedSalesperson) els.importSalesperson.value = detectedSalesperson;
    const uploadLabel = isInvoiceUpload ? "Invoice" : forcedCostType;
    els.importStatus.textContent = `Reading ${file.name} for ${defaultSalesperson} (${uploadLabel})...`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const rows = await parseUploadRows(file, bytes);
    const records = isInvoiceUpload ? rowsToInvoiceRecords(rows, selectedMonth) : rowsToCostRecords(rows, selectedMonth, forcedCostType);
    if (!records.length) {
      els.importStatus.textContent = isInvoiceUpload ? "No IV invoices found in this file." : "No cost rows found in this file.";
      return;
    }

    const monthSummary = summarizeRecordMonths(records, importType);
    const wrongMonthRecords = records.filter((record) => record.date?.slice(0, 7) && record.date.slice(0, 7) !== selectedMonth);
    if (wrongMonthRecords.length) {
      const sample = wrongMonthRecords
        .slice(0, 8)
        .map((record) => `${isInvoiceUpload ? record.invoiceNo : record.docNo} (${record.date})`)
        .join("\n");
      alert(
        [
          "Upload blocked: month mismatch.",
          "",
          `Selected month: ${selectedMonth}`,
          `Months found: ${monthSummary.label}`,
          `Wrong-month rows: ${wrongMonthRecords.length}`,
          "",
          sample,
          wrongMonthRecords.length > 8 ? "..." : "",
          "",
          "Please fix the Excel file before uploading.",
        ].filter(Boolean).join("\n"),
      );
      els.importStatus.textContent = `Upload blocked. Selected ${selectedMonth}, but file has ${monthSummary.label}.`;
      return;
    }
    const firstRecord = isInvoiceUpload ? records[0]?.invoiceNo : records[0]?.docNo;
    const lastRecord = isInvoiceUpload ? records.at(-1)?.invoiceNo : records.at(-1)?.docNo;
    const confirmed = confirm(
      [
        "Confirm Excel upload?",
        "",
        `File: ${file.name}`,
        `Type: ${isInvoiceUpload ? "Invoice" : `Cost - ${forcedCostType}`}`,
        `Salesperson: ${defaultSalesperson}`,
        `Selected month: ${selectedMonth}`,
        `Months found: ${monthSummary.label}`,
        `${isInvoiceUpload ? "IV invoices" : "Cost rows"} found: ${records.length}`,
        firstRecord && lastRecord ? `Range: ${firstRecord} to ${lastRecord}` : "",
        "",
        "Press OK to import, or Cancel to stop.",
      ].filter(Boolean).join("\n"),
    );

    if (!confirmed) {
      els.importStatus.textContent = `Upload cancelled: ${file.name}`;
      return;
    }

    if (!isInvoiceUpload) {
      const result = importCostRecords(records);
      persist();
      els.dateFromFilter.value = `${selectedMonth}-01`;
      els.dateToFilter.value = "";
      els.importStatus.textContent = `Imported ${result.created} new ${forcedCostType} costs, updated ${result.updated}, unlinked ${result.unlinked}. Months: ${monthSummary.label}.`;
      refreshInvoiceOptions();
      switchView("costs");
      return;
    }

    let created = 0;
    let updated = 0;
    for (const record of records) {
      const existing = state.invoices.find((invoice) => invoice.invoiceNo.toUpperCase() === record.invoiceNo.toUpperCase());
      if (existing) {
        existing.date = record.date || existing.date;
        existing.customer = record.customer || existing.customer;
        existing.amount = record.amount;
        existing.agentOrder = record.agentOrder;
        existing.outstanding = record.outstanding;
        if (!getSalespeople().includes(existing.salesperson)) existing.salesperson = defaultSalesperson;
        if (/^Imported from /i.test(existing.note || "")) existing.note = "";
        updated += 1;
      } else {
        state.invoices.push({
          id: createId(),
          invoiceNo: record.invoiceNo,
          date: record.date,
          salesperson: defaultSalesperson,
          customer: record.customer,
          amount: record.amount,
          agentOrder: record.agentOrder,
          outstanding: record.outstanding,
          note: "",
          settled: false,
          settledAt: "",
          trashedAt: "",
        });
      created += 1;
      }
    }

    persist();
    els.dateFromFilter.value = `${selectedMonth}-01`;
    els.dateToFilter.value = "";
    els.importStatus.textContent = `Imported ${created} new, updated ${updated} for ${defaultSalesperson}. Months: ${monthSummary.label}.`;
    refreshInvoiceOptions();
    switchView("invoices");
  } catch (error) {
    console.error(error);
    els.importStatus.textContent = "Import failed. Please use the Sales Local invoice collection .xls report.";
  } finally {
    event.target.value = "";
  }
}

async function importFacebookListingFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const pageSalesperson = els.facebookSalespersonFilter?.value;
    const globalSalesperson = els.salespersonFilter.value;
    const salesperson =
      detectSalesperson(file.name) ||
      (pageSalesperson && pageSalesperson !== "All" ? pageSalesperson : "") ||
      (globalSalesperson && globalSalesperson !== "All" ? globalSalesperson : "") ||
      getSalespeople()[0] ||
      "";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const rows = await parseUploadRows(file, bytes);
    const records = rowsToFacebookListingRecords(rows, salesperson, file.name);
    if (!records.length) {
      alert("No Facebook listing rows found. Please upload the Sales Order Schedule Excel.");
      return;
    }
    const existing = new Map(state.facebookListings.map((row) => [facebookListingKey(row), row]));
    let created = 0;
    let updated = 0;
    records.forEach((record) => {
      const key = facebookListingKey(record);
      if (existing.has(key)) {
        Object.assign(existing.get(key), record);
        updated += 1;
      } else {
        state.facebookListings.push(record);
        created += 1;
      }
    });
    renumberFacebookListings();
    persist();
    if (els.facebookSalespersonFilter && salesperson) els.facebookSalespersonFilter.value = salesperson;
    switchView("facebook");
    render();
    alert(`Imported ${created} new Facebook listings, updated ${updated}.`);
  } catch (error) {
    console.error(error);
    alert("Facebook listing import failed. Please use the old Sales Order Schedule .xls file.");
  } finally {
    event.target.value = "";
  }
}

async function parseUploadRows(file, bytes) {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const response = await fetch("/api/parse-upload", {
      method: "POST",
      headers: { "X-File-Name": encodeURIComponent(file.name) },
      body: bytes,
    });
    if (!response.ok) throw new Error(`Server parser failed: ${response.status}`);
    const payload = await response.json();
    return payload.rows || [];
  }
  return parseInvoiceReportRows(bytes);
}

function parseInvoiceReportRows(bytes) {
  if (u32(bytes, 0) !== 0xe011cfd0) return parseTextRows(bytes);
  return workbookRows(getWorkbookStream(bytes));
}

function detectSalesperson(filename) {
  const lower = filename.toLowerCase();
  return getSalespeople().find((name) => lower.includes(name.toLowerCase())) || "";
}

function parseInvoiceReport(bytes) {
  const rows = parseInvoiceReportRows(bytes);
  return rowsToInvoiceRecords(rows, selectedImportMonth());
}

function rowsToInvoiceRecords(rows, selectedMonth) {
  const headerRowIndex = rows.findIndex((row) => row?.some((cell) => cleanText(cell) === "Doc. No"));
  if (headerRowIndex < 0) return [];

  const headers = rows[headerRowIndex].map(cleanText);
  const docCol = findHeader(headers, ["Doc. No", "Invoice No"]);
  const dateCol = findHeader(headers, ["Doc. Date", "Date"]);
  const nameCol = findHeader(headers, ["Name", "Customer"]);
  const amountCol = headers.findIndex((header) => header === "Amount");
  const agentOrderCol = findHeader(headers, ["Agent Sales", "AGENT SALES", "Agent Order", "AGENT ORDER"]);
  const outstandingCol = headers.findIndex((header) => header === "Outstanding");

  if (docCol >= 0) {
    return rows
      .slice(headerRowIndex + 1)
      .map((row) => extractInvoiceRowFromColumns(row, { docCol, dateCol, nameCol, amountCol, agentOrderCol, outstandingCol }, selectedMonth))
      .filter(Boolean);
  }

  return rows
    .slice(headerRowIndex + 1)
    .map((row) => extractInvoiceRow(row, amountCol, agentOrderCol, outstandingCol, selectedMonth))
    .filter(Boolean);
}

function extractInvoiceRowFromColumns(row, columns, selectedMonth) {
  if (!row) return null;
  const invoiceNo = cleanText(row[columns.docCol]).toUpperCase();
  if (!invoiceNo || /^grand total/i.test(invoiceNo)) return null;
  const rawDate = columns.dateCol >= 0 ? row[columns.dateCol] : "";
  const date = normalizeImportDate(rawDate, selectedMonth || invoiceMonth(invoiceNo));
  const customer = columns.nameCol >= 0 ? cleanText(row[columns.nameCol]) : "";
  const amount = parseMoney(row[columns.amountCol >= 0 ? columns.amountCol : 3]);
  const agentOrder = parseMoney(row[columns.agentOrderCol >= 0 ? columns.agentOrderCol : -1]);
  const outstanding = parseMoney(row[columns.outstandingCol >= 0 ? columns.outstandingCol : columns.agentOrderCol >= 0 ? columns.agentOrderCol + 1 : 4]);
  return { invoiceNo, date, customer, amount, agentOrder, outstanding };
}

function parseTextRows(bytes) {
  const text = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/\t|,/).map(cleanText))
    .filter((row) => row.some(Boolean));
}

function parseTextInvoiceReport(bytes) {
  const rows = parseTextRows(bytes);
  return rowsToInvoiceRecords(rows, selectedImportMonth());
}

function rowsToCostRecords(rows, selectedMonth, forcedType = "") {
  const headerRowIndex = rows.findIndex((row) => row.some((cell) => cell === "Doc. No"));
  if (headerRowIndex < 0) return [];
  const headers = rows[headerRowIndex];
  const docCol = findHeader(headers, ["Cost Doc No", "Doc. No", "Cost No"]);
  const invoiceCol = findHeader(headers, ["IV Number", "Invoice No", "Linked Invoice", "IV No"]);
  const typeCol = findHeader(headers, ["Cost Type", "Type"]);
  const dateCol = findHeader(headers, ["Doc. Date", "Date"]);
  const amountCol = findHeader(headers, ["Amount (RM)", "Amount", "Cost Amount"]);
  const noteCol = findHeader(headers, ["Note", "Remark"]);
  const nameCol = findHeader(headers, ["Name", "Supplier"]);
  return rows
    .slice(headerRowIndex + 1)
    .filter((row) => cleanText(row[docCol]))
    .map((row) => ({
      docNo: cleanText(row[docCol]).toUpperCase(),
      invoiceNo: cleanText(row[invoiceCol]).toUpperCase(),
      type: forcedType || (COST_TYPES.includes(cleanText(row[typeCol])) ? cleanText(row[typeCol]) : "Purchase"),
      date: normalizeImportDate(row[dateCol], selectedMonth),
      amount: parseMoney(row[amountCol]),
      note: cleanText(row[noteCol]) || cleanText(row[nameCol]),
    }));
}

function rowsToFacebookListingRecords(rows, salesperson, filename = "") {
  const headerRowIndex = rows.findIndex((row) => row?.some((cell) => cleanText(cell) === "Customer Number"));
  if (headerRowIndex < 0) return [];
  const headers = rows[headerRowIndex].map(cleanText);
  const noCol = findHeader(headers, ["No.", "No"]);
  const invoiceCol = findHeader(headers, ["INV. No.", "Inv. No.", "Invoice No", "IV Number"]);
  const dateCol = findHeader(headers, ["Date"]);
  const numberCol = findHeader(headers, ["Customer Number", "Contact Number", "Phone"]);
  const postCol = findHeader(headers, ["Post", "Ad Post", "Ads Post"]);
  const sourceCol = findHeader(headers, ["From", "Source"]);
  const datelineCol = findHeader(headers, ["Deal Dateline", "Deadline", "Deal Date"]);
  const amountCol = findHeader(headers, ["Amount"]);
  const statusCol = findHeader(headers, ["Status"]);
  const remarksCol = findHeader(headers, ["Remarks", "Remark", "Note"]);

  return rows
    .slice(headerRowIndex + 1)
    .map((row, index) => {
      const customerNumber = cleanText(row?.[numberCol]);
      const status = normalizeFacebookStatus(row?.[statusCol]);
      if (!customerNumber && !cleanText(row?.[invoiceCol]) && !status) return null;
      return {
        id: createId(),
        no: cleanText(row?.[noCol]) || String(index + 1),
        invoiceNo: cleanText(row?.[invoiceCol]).toUpperCase(),
        date: parseFacebookListingDate(row?.[dateCol]),
        customerNumber,
        post: cleanText(row?.[postCol]),
        source: cleanText(row?.[sourceCol]),
        salesperson,
        dealDateline: parseFacebookListingDate(row?.[datelineCol]),
        amount: parseMoneyValue(row?.[amountCol]),
        outstanding: 0,
        status,
        statusUpdatedAt: parseFacebookListingDate(row?.[dateCol]) || todayInputValue(),
        remarks: cleanText(row?.[remarksCol]),
        importedFrom: filename,
      };
    })
    .filter(Boolean);
}

function normalizeFacebookStatus(value) {
  const text = cleanText(value);
  return FACEBOOK_STATUSES.find((status) => status.toLowerCase() === text.toLowerCase()) || text;
}

function parseFacebookListingDate(value) {
  if (typeof value === "number") return excelSerialDate(value);
  const text = cleanText(value);
  if (!text) return "";
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(text)) {
    const [day, month, year] = text.split(".");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) return parseReportDate(text);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return text;
}

function parseMoneyValue(value) {
  if (typeof value === "number") return value;
  const text = cleanText(value);
  const negative = /^\(.+\)$/.test(text);
  const amount = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? (negative ? -amount : amount) : 0;
}

function facebookListingKey(row) {
  return [
    row.salesperson || "",
    row.invoiceNo || "",
    row.date || "",
    row.customerNumber || "",
    row.post || "",
    row.no || "",
  ].join("__").toLowerCase();
}

function extractInvoiceRow(row, amountCol, agentOrderCol, outstandingCol, selectedMonth) {
  if (!row) return null;
  const docIndex = row.findIndex((cell) => /^IV\d{4}-\d+/i.test(cleanText(cell)));
  if (docIndex < 0) return null;
  const invoiceNo = cleanText(row[docIndex]).toUpperCase();
  const dateIndex = row.findIndex((cell, index) => index > docIndex && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanText(cell)));
  const codeIndex = row.findIndex((cell, index) => index > docIndex && /^300-/i.test(cleanText(cell)));
  const date = dateIndex >= 0 ? normalizeImportDate(cleanText(row[dateIndex]), selectedMonth) : `${selectedMonth || invoiceMonth(invoiceNo) || selectedFilterMonth()}-01`;
  const customer = codeIndex >= 0 ? cleanText(row[codeIndex + 1]) : cleanText(row[docIndex + 3]);
  const amount = parseMoney(row[amountCol >= 0 ? amountCol : 6]);
  const agentOrder = parseMoney(row[agentOrderCol >= 0 ? agentOrderCol : -1]);
  const outstanding = parseMoney(row[outstandingCol >= 0 ? outstandingCol : row.length - 1]);
  return { invoiceNo, date, customer, amount, agentOrder, outstanding };
}

function findHeader(headers, candidates) {
  return candidates.map((candidate) => headers.findIndex((header) => cleanText(header) === candidate)).find((index) => index >= 0) ?? -1;
}

function normalizeImportDate(value, selectedMonth) {
  if (typeof value === "number") return excelSerialDate(value);
  value = cleanText(value);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) return parseReportDate(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return `${selectedMonth || selectedFilterMonth()}-01`;
}

function excelSerialDate(serial) {
  const date = new Date(Date.UTC(1899, 11, 30) + Number(serial) * 86400000);
  return date.toISOString().slice(0, 10);
}

function importCostRecords(records) {
  let created = 0;
  let updated = 0;
  let unlinked = 0;
  for (const record of records) {
    const rawLink = cleanText(record.invoiceNo);
    const isProduction = !rawLink || isProductionValue(rawLink);
    const owner = getSalespeople().find((name) => rawLink.toLowerCase() === name.toLowerCase()) || (isProduction ? "Production" : "");
    const invoice = isProduction ? null : state.invoices.find((row) => row.invoiceNo.toUpperCase() === record.invoiceNo);
    if (!isProduction && !invoice) unlinked += 1;
    const existing = state.costs.find((cost) => cost.docNo.toUpperCase() === record.docNo);
    const cost = {
      id: existing?.id || createId(),
      invoiceId: invoice?.id || "",
      linkedInvoiceNo: isProduction ? "Production" : record.invoiceNo,
      owner,
      type: record.type,
      docNo: record.docNo,
      amount: record.amount,
      date: record.date,
      note: isProduction ? `${record.note ? `${record.note} · ` : ""}Production` : record.note,
      lateCost: existing?.lateCost || false,
      lateCostAt: existing?.lateCostAt || "",
      trashedAt: "",
    };
    if (existing) {
      Object.assign(existing, cost);
      updated += 1;
    } else {
      state.costs.push(cost);
      created += 1;
    }
  }
  return { created, updated, unlinked };
}

function getWorkbookStream(bytes) {
  if (u32(bytes, 0) !== 0xe011cfd0) throw new Error("Not an OLE .xls file");
  const sectorSize = 1 << u16(bytes, 30);
  const miniSectorSize = 1 << u16(bytes, 32);
  const firstDirSector = i32(bytes, 48);
  const firstMiniFatSector = i32(bytes, 60);
  const miniFatSectorCount = u32(bytes, 64);
  const difat = [];
  for (let offset = 76; offset < 512; offset += 4) {
    const value = i32(bytes, offset);
    if (value >= 0) difat.push(value);
  }

  const fat = [];
  for (const sector of difat) {
    const fatSector = readSector(bytes, sector, sectorSize);
    for (let i = 0; i < fatSector.length; i += 4) fat.push(i32(fatSector, i));
  }

  const dirStream = readChain(bytes, firstDirSector, fat, sectorSize);
  const entries = [];
  for (let offset = 0; offset + 128 <= dirStream.length; offset += 128) {
    const nameLength = u16(dirStream, offset + 64);
    if (!nameLength) continue;
    entries.push({
      name: decodeUtf16(dirStream.subarray(offset, offset + nameLength - 2)),
      type: dirStream[offset + 66],
      start: i32(dirStream, offset + 116),
      size: u32(dirStream, offset + 120),
    });
  }

  const root = entries.find((entry) => entry.type === 5);
  const workbook = entries.find((entry) => /^(Workbook|Book)$/i.test(entry.name));
  if (!root || !workbook) throw new Error("Workbook stream not found");

  if (workbook.size < 4096) {
    const miniFatStream = miniFatSectorCount ? readChain(bytes, firstMiniFatSector, fat, sectorSize) : new Uint8Array();
    const miniFat = [];
    for (let i = 0; i < miniFatStream.length; i += 4) miniFat.push(i32(miniFatStream, i));
    const miniStream = readChain(bytes, root.start, fat, sectorSize).subarray(0, root.size);
    const chunks = [];
    let sector = workbook.start;
    const seen = new Set();
    while (sector >= 0 && sector < miniFat.length && !seen.has(sector)) {
      seen.add(sector);
      const start = sector * miniSectorSize;
      chunks.push(miniStream.subarray(start, start + miniSectorSize));
      const next = miniFat[sector];
      if (next === -2 || next === -1) break;
      sector = next;
    }
    return concatBytes(chunks).subarray(0, workbook.size);
  }

  return readChain(bytes, workbook.start, fat, sectorSize).subarray(0, workbook.size);
}

function workbookRows(stream) {
  const cells = new Map();
  const sst = [];
  let pos = 0;
  while (pos + 4 <= stream.length) {
    const id = u16(stream, pos);
    const len = u16(stream, pos + 2);
    const data = stream.subarray(pos + 4, pos + 4 + len);
    pos += 4 + len;

    if (id === 0x00fc) {
      let p = 8;
      while (p < data.length - 3) {
        const parsed = parseXLString(data, p);
        sst.push(parsed.text);
        p = parsed.next;
      }
    } else if (id === 0x00fd) {
      cells.set(`${u16(data, 0)}:${u16(data, 2)}`, sst[u32(data, 6)] ?? "");
    } else if (id === 0x0203) {
      cells.set(`${u16(data, 0)}:${u16(data, 2)}`, f64(data, 6));
    } else if (id === 0x027e) {
      cells.set(`${u16(data, 0)}:${u16(data, 2)}`, decodeRK(u32(data, 6)));
    } else if (id === 0x00bd) {
      const row = u16(data, 0);
      const firstCol = u16(data, 2);
      const lastCol = u16(data, data.length - 2);
      let p = 4;
      for (let col = firstCol; col <= lastCol; col += 1) {
        p += 2;
        cells.set(`${row}:${col}`, decodeRK(u32(data, p)));
        p += 4;
      }
    } else if (id === 0x0204) {
      cells.set(`${u16(data, 0)}:${u16(data, 2)}`, decodeLatin1(data.subarray(8)).replace(/\0/g, ""));
    }
  }

  const rows = [];
  for (const [key, value] of cells) {
    const [row, col] = key.split(":").map(Number);
    rows[row] ||= [];
    rows[row][col] = value;
  }
  return rows;
}

function readSector(bytes, sector, sectorSize) {
  const start = (sector + 1) * sectorSize;
  return bytes.subarray(start, start + sectorSize);
}

function readChain(bytes, startSector, fat, sectorSize) {
  const chunks = [];
  let sector = startSector;
  const seen = new Set();
  while (sector >= 0 && sector < fat.length && !seen.has(sector)) {
    seen.add(sector);
    chunks.push(readSector(bytes, sector, sectorSize));
    const next = fat[sector];
    if (next === -2 || next === -1 || next === -3 || next === -4) break;
    sector = next;
  }
  return concatBytes(chunks);
}

function parseXLString(data, offset) {
  const cch = u16(data, offset);
  const flags = data[offset + 2];
  let pos = offset + 3;
  const rich = flags & 0x08 ? u16(data, pos) : 0;
  if (flags & 0x08) pos += 2;
  const ext = flags & 0x04 ? u32(data, pos) : 0;
  if (flags & 0x04) pos += 4;
  const high = flags & 0x01;
  const byteLength = cch * (high ? 2 : 1);
  const raw = data.subarray(pos, pos + byteLength);
  const text = high ? decodeUtf16(raw) : decodeLatin1(raw);
  return { text, next: pos + byteLength + rich * 4 + ext };
}

function decodeRK(rk) {
  const divide = rk & 0x01;
  const isInt = rk & 0x02;
  let value;
  if (isInt) {
    value = rk >> 2;
  } else {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setUint32(4, rk & 0xfffffffc, true);
    value = new DataView(bytes.buffer).getFloat64(0, true);
  }
  return divide ? value / 100 : value;
}

function parseMoney(value) {
  if (typeof value === "number") return value;
  const text = cleanText(value);
  if (!text) return 0;
  const negative = /^\(.+\)$/.test(text);
  const amount = Number(text.replace(/[(),]/g, ""));
  return Number.isFinite(amount) ? (negative ? -amount : amount) : 0;
}

function parseReportDate(text) {
  const [day, month, year] = text.split("/").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function invoiceMonth(invoiceNo) {
  const match = /^IV(\d{2})(\d{2})-/i.exec(invoiceNo);
  if (!match) return "";
  return `20${match[1]}-${match[2]}`;
}

function mostCommon(values) {
  const counts = {};
  values.forEach((value) => (counts[value] = (counts[value] || 0) + 1));
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function summarizeRecordMonths(records, importType) {
  const counts = {};
  records.forEach((record) => {
    const month =
      record.date?.slice(0, 7) ||
      (importType === "invoice" ? invoiceMonth(record.invoiceNo) : invoiceMonth(record.invoiceNo)) ||
      els.importMonth.value ||
      selectedFilterMonth();
    if (month) counts[month] = (counts[month] || 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  return {
    months: entries.map(([month]) => month),
    label: entries.length ? entries.map(([month, count]) => `${month}: ${count}`).join(", ") : "unknown",
  };
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function concatBytes(chunks) {
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, offset);
    offset += chunk.length;
  });
  return out;
}

function u16(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
}

function u32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function i32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getInt32(0, true);
}

function f64(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getFloat64(0, true);
}

function decodeUtf16(bytes) {
  return new TextDecoder("utf-16le").decode(bytes);
}

function decodeLatin1(bytes) {
  return new TextDecoder("latin1").decode(bytes);
}

function resetData() {
  if (!confirm("Delete all invoices and cost bills?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_KEY);
  state = normalizeState({ invoices: [], costs: [], facebookListings: [] });
  persist();
  setDefaultMonth();
  clearInvoiceForm();
  clearCostForm();
  clearFacebookListingForm();
  switchView("dashboard");
}

function groupBy(rows, keyFn) {
  return rows.reduce((map, row) => {
    const key = keyFn(row);
    map[key] ||= [];
    map[key].push(row);
    return map;
  }, {});
}

function setupCanvas(canvas) {
  const scale = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * scale;
  canvas.height = rect.height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  return ctx;
}

function drawEmpty(ctx, width, height) {
  ctx.fillStyle = "#68707c";
  ctx.font = "13px Segoe UI";
  ctx.fillText("No data yet", width / 2 - 28, height / 2);
}

function csvRow(values) {
  return values.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",");
}

function download(filename, text, type) {
  try {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 1000);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

document.querySelector("#costAmount").addEventListener("input", renderLinkedPreview);
init();



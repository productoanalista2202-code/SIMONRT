import React, { useState } from 'react';
import { Sidebar, MainNavView } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ClinicalKanbanBoard } from './components/board/ClinicalKanbanBoard';
import { PatientStageChecklistTable } from './components/list/PatientStageChecklistTable';
import { PatientDetailView } from './components/patient/PatientDetailView';
import { SettingsView } from './components/settings/SettingsView';

import { RequirementsModal } from './components/modals/RequirementsModal';
import { AddNoteModal } from './components/modals/AddNoteModal';
import { MedicalHistoryModal } from './components/modals/MedicalHistoryModal';
import { SessionActionModal } from './components/modals/SessionActionModal';

import {
  INITIAL_PATIENTS,
  INITIAL_TRACEABILITY_LOGS,
  CLINICAL_STAGES,
  getOfficialStageActivities
} from './data/mockSimonData';
import {
  ActivityRequirement,
  ClinicalStageId,
  Patient,
  RadiotherapySession,
  StageActivity,
  TraceabilityEvent,
  TreatmentFrequency
} from './types/simon';

export default function App() {
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [activeView, setActiveView] = useState<MainNavView>('tablero');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('PAC-001');
  const [selectedStageId, setSelectedStageId] = useState<ClinicalStageId>('primera_consulta');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Persisted state for Lista Integral de Pacientes to preserve context upon return
  const [listSearchTerm, setListSearchTerm] = useState<string>('');
  const [listSelectedEps, setListSelectedEps] = useState<string>('all');
  const [listSelectedProgram, setListSelectedProgram] = useState<string>('all');
  const [listStatusFilter, setListStatusFilter] = useState<string>('all');
  const [listViewMode, setListViewMode] = useState<'detallada' | 'compacta'>('detallada');
  const [listExpandedPatientId, setListExpandedPatientId] = useState<string>('PAC-001');

  // Modals state
  const [requirementsModalData, setRequirementsModalData] = useState<{
    activity: StageActivity;
    patient: Patient;
  } | null>(null);

  const [noteModalData, setNoteModalData] = useState<{
    activity: StageActivity;
    patient: Patient;
  } | null>(null);

  const [sessionModalData, setSessionModalData] = useState<{
    session: RadiotherapySession;
    patientName: string;
    schemeId: string;
  } | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Active selected patient object
  const selectedPatient =
    patients.find((p) => p.id === selectedPatientId) || patients[0];

  // Navigate to patient detail
  const handleSelectPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    setActiveView('paciente_detalle');
  };

  // Return to patient list preserving previous list context
  const handleBackToList = () => {
    setActiveView('listado');
  };

  // Navigate to stage list
  const handleViewStageList = (stageId: ClinicalStageId) => {
    setSelectedStageId(stageId);
    setActiveView('listado');
  };

  // Move patient to another stage
  const handleUpdatePatientStage = (newStageId: ClinicalStageId) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === selectedPatient.id
          ? {
              ...p,
              currentStageId: newStageId
            }
          : p
      )
    );
  };

  // Update activity requirements
  const handleSaveRequirements = (
    activityId: string,
    updatedRequirements: ActivityRequirement[]
  ) => {
    if (!requirementsModalData) return;
    const { patient } = requirementsModalData;

    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patient.id) return p;

        const updatedActivities = p.activities.map((act) =>
          act.id === activityId
            ? {
                ...act,
                requirements: updatedRequirements
              }
            : act
        );

        return {
          ...p,
          activities: updatedActivities
        };
      })
    );
  };

  // Add note to activity
  const handleSaveNote = (noteData: {
    activityId: string;
    activityName: string;
    text: string;
    registeredBy: string;
    date: string;
    time: string;
  }) => {
    if (!noteModalData) return;
    const { patient } = noteModalData;

    const newNote = {
      id: `NOT-${Date.now()}`,
      ...noteData
    };

    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patient.id) return p;

        return {
          ...p,
          notes: [newNote, ...p.notes]
        };
      })
    );
  };

  // Session Action (Execute, Reschedule, Cancel) in Radiotherapy
  const handleConfirmSessionAction = (data: {
    sessionId: string;
    action: 'realizar' | 'reprogramar' | 'cancelar';
    date: string;
    time: string;
    administeredDoseGy?: number;
    igrtVerification?: string;
    patientTolerance?: RadiotherapySession['patientTolerance'];
    cancellationReason?: string;
    notes?: string;
  }) => {
    if (!sessionModalData) return;
    const { session } = sessionModalData;

    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== session.patientId) return p;

        let sessionsList = p.sessions;
        // If sessions list was empty (using generated demo slots), initialize it
        if (sessionsList.length === 0) {
          sessionsList = Array.from({
            length: p.scheme.totalSessionsPrescribed || 25
          }).map((_, idx) => ({
            id: `SES-${p.id}-${idx + 1}`,
            schemeId: p.scheme.id,
            patientId: p.id,
            sessionNumber: idx + 1,
            totalPrescribed: p.scheme.totalSessionsPrescribed || 25,
            scheduledDate: `${(idx % 28) + 1}/11/2026`,
            scheduledTime: '09:00 a.m.',
            status:
              idx < p.scheme.totalSessionsCompleted ? 'Realizada' : 'Programada',
            administeredDoseGy: p.scheme.fractionDose,
            accelerator: p.scheme.acceleratorId,
            technologist: 'Tec. Julián Morales',
            patientTolerance: 'Tolerancia OK'
          }));
        }

        const updatedSessions = sessionsList.map((s) => {
          if (s.sessionNumber === session.sessionNumber) {
            return {
              ...s,
              status:
                data.action === 'realizar'
                  ? ('Realizada' as const)
                  : data.action === 'reprogramar'
                  ? ('Reprogramada' as const)
                  : ('Cancelada' as const),
              scheduledDate: data.date,
              scheduledTime: data.time,
              administeredDoseGy: data.administeredDoseGy || s.administeredDoseGy,
              igrtVerification: data.igrtVerification || s.igrtVerification,
              patientTolerance: data.patientTolerance || s.patientTolerance,
              cancellationReason: data.cancellationReason,
              notes: data.notes
            };
          }
          return s;
        });

        const newCompleted = updatedSessions.filter(
          (s) => s.status === 'Realizada'
        ).length;
        const newCancelled = updatedSessions.filter(
          (s) => s.status === 'Cancelada' || s.status === 'Reprogramada'
        ).length;

        return {
          ...p,
          sessions: updatedSessions,
          scheme: {
            ...p.scheme,
            totalSessionsCompleted: newCompleted,
            totalSessionsCancelled: newCancelled,
            totalSessionsPending: Math.max(
              0,
              p.scheme.totalSessionsPrescribed - newCompleted
            ),
            status:
              newCompleted >= p.scheme.totalSessionsPrescribed
                ? 'Completado'
                : 'En ejecución'
          }
        };
      })
    );
  };

  // Adjust Scheme Frequency and Prescribed sessions
  const handleUpdateSchemeFrequency = (
    frequency: TreatmentFrequency,
    totalSessions: number
  ) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === selectedPatient.id
          ? {
              ...p,
              scheme: {
                ...p.scheme,
                frequency,
                totalSessionsPrescribed: totalSessions,
                totalSessionsPending: Math.max(
                  0,
                  totalSessions - p.scheme.totalSessionsCompleted
                )
              }
            }
          : p
      )
    );
  };

  // Filtered patients for global header search
  const visiblePatients = globalSearch.trim()
    ? patients.filter(
        (p) =>
          p.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
          p.documentNumber.includes(globalSearch) ||
          p.clinicalDiagnosis.toLowerCase().includes(globalSearch.toLowerCase())
      )
    : patients;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased">
      {/* Royal Blue Sidebar matching mockups: Only Tablero & Configuración */}
      <Sidebar
        activeView={activeView}
        onNavigate={(view) => setActiveView(view)}
        selectedPatientName={selectedPatient?.name}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto min-h-screen">
        {/* Top Header with Breadcrumbs, Search and User Profile */}
        <Header
          activeView={activeView}
          onNavigate={(view) => setActiveView(view)}
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          unreadAlertsCount={3}
        />

        {/* Dynamic Main View */}
        <main className="flex-1">
          {activeView === 'tablero' && (
            <ClinicalKanbanBoard
              patients={visiblePatients}
              onSelectPatient={handleSelectPatient}
              onViewStageList={handleViewStageList}
            />
          )}

          {activeView === 'listado' && (
            <PatientStageChecklistTable
              patients={visiblePatients}
              selectedStageId={selectedStageId}
              onSelectStage={(stageId) => setSelectedStageId(stageId)}
              onSelectPatient={handleSelectPatient}
              searchTerm={listSearchTerm}
              onSearchTermChange={setListSearchTerm}
              selectedEps={listSelectedEps}
              onSelectedEpsChange={setListSelectedEps}
              selectedProgram={listSelectedProgram}
              onSelectedProgramChange={setListSelectedProgram}
              statusFilter={listStatusFilter}
              onStatusFilterChange={setListStatusFilter}
              viewMode={listViewMode}
              onViewModeChange={setListViewMode}
              expandedPatientId={listExpandedPatientId}
              onExpandedPatientIdChange={setListExpandedPatientId}
              onOpenRequirements={(activityId, patient) => {
                const act =
                  patient.activities.find((a) => a.id === activityId) ||
                  getOfficialStageActivities(selectedStageId, patient.id).find((a) => a.id === activityId) ||
                  getOfficialStageActivities(selectedStageId, patient.id)[0];
                setRequirementsModalData({ activity: act, patient });
              }}
            />
          )}

          {activeView === 'paciente_detalle' && (
            <PatientDetailView
              patient={selectedPatient}
              onBackToList={handleBackToList}
              onOpenRequirements={(activity) =>
                setRequirementsModalData({ activity, patient: selectedPatient })
              }
              onOpenAddNote={(activity) =>
                setNoteModalData({ activity, patient: selectedPatient })
              }
              onOpenHistory={() => setIsHistoryModalOpen(true)}
              onOpenSessionAction={(session) =>
                setSessionModalData({
                  session,
                  patientName: selectedPatient.name,
                  schemeId: selectedPatient.scheme.id
                })
              }
              onUpdatePatientStage={handleUpdatePatientStage}
              onUpdateSchemeFrequency={handleUpdateSchemeFrequency}
            />
          )}

          {activeView === 'configuracion' && <SettingsView />}
        </main>
      </div>

      {/* Modal 1: Requirements Modal (Mockup 5, with integrated Scheme and Destination) */}
      {requirementsModalData && (
        <RequirementsModal
          activity={requirementsModalData.activity}
          patientName={requirementsModalData.patient.name}
          schemeData={{
            id: requirementsModalData.patient.scheme.id,
            treatmentName: requirementsModalData.patient.scheme.treatmentName,
            acceleratorId: requirementsModalData.patient.scheme.acceleratorId
          }}
          onClose={() => setRequirementsModalData(null)}
          onSave={handleSaveRequirements}
        />
      )}

      {/* Modal 2: Add Note Modal (Mockup 7) */}
      {noteModalData && (
        <AddNoteModal
          activity={noteModalData.activity}
          patientName={noteModalData.patient.name}
          onClose={() => setNoteModalData(null)}
          onSave={handleSaveNote}
        />
      )}

      {/* Modal 3: Medical History Modal */}
      {isHistoryModalOpen && (
        <MedicalHistoryModal
          patient={selectedPatient}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      )}

      {/* Modal 4: Radiotherapy Session Action Modal (Stage 5 Radiotherapy) */}
      {sessionModalData && (
        <SessionActionModal
          session={sessionModalData.session}
          patientName={sessionModalData.patientName}
          schemeId={sessionModalData.schemeId}
          onClose={() => setSessionModalData(null)}
          onConfirm={handleConfirmSessionAction}
        />
      )}
    </div>
  );
}

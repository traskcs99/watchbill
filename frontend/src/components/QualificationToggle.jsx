import React, { useState } from 'react';

const QualificationToggle = ({ personId, stationId, existingQual, onUpdate }) => {
    // 1. State to show a loading spinner or disable the button while the API works
    const [isSaving, setIsSaving] = useState(false);

    // 2. Logic to handle checking/unchecking
    const handleToggle = async () => {
        setIsSaving(true);
        if (existingQual) {
            // UNCHECKING: Send a DELETE request using the qualification ID
            await fetch(`/api/qualifications/${existingQual.id}`, { method: 'DELETE' });
        } else {
            // CHECKING: Send a POST request to create a new one, defaulting to today
            const today = new Date().toISOString().split('T')[0];
            await fetch('/api/qualifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    person_id: personId,
                    station_id: stationId,
                    earned_date: today
                })
            });
        }
        onUpdate(); // Tell the parent component to refresh the data from the backend
        setIsSaving(false);
    };

    // 3. Logic to handle changing the date
    const handleDateChange = async (newDate) => {
        setIsSaving(true);
        await fetch(`/api/qualifications/${existingQual.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ earned_date: newDate })
        });
        onUpdate();
        setIsSaving(false);
    };

    return (
        <div className="flex items-center gap-2">
            <input
                type="checkbox"
                checked={!!existingQual} // !! turns an object/null into true/false
                onChange={handleToggle}
                disabled={isSaving}
                className="w-4 h-4 cursor-pointer"
            />

            {/* 4. Conditional Rendering: Only show the date picker if they are qualified */}
            {existingQual && (
                <input
                    type="date"
                    value={existingQual.earned_date || ""}
                    onChange={(e) => handleDateChange(e.target.value)}
                    disabled={isSaving}
                    className="text-sm border rounded px-1 text-gray-700 bg-white"
                />
            )}
        </div>
    );
};
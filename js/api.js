/**
 * API Handler for Amenity Scheduler
 * Handles communication with Firebase Firestore
 */

const API = {
    // Methods
    getReservations: async (options = {}) => {
        try {
            console.log('📡 Fetching reservations from Firestore...');
            const snapshot = await db.collection('reservations').get();
            const reservations = snapshot.docs.map(doc => ({
                tx_id: doc.id,
                ...doc.data()
            }));
            return { status: 'success', data: reservations };
        } catch (error) {
            console.error('Error getting reservations:', error);
            return { status: 'error', message: error.message };
        }
    },



    createItem: async (item) => {
        try {
            console.log('Creating item:', item);
            // Add metadata
            const data = {
                ...item,
                created_at: new Date().toISOString()
            };

            // If item_id is not provided, generate one or let Firestore do it?
            // User requirement says "Item ID" is a column, implying it might be manual or auto.
            // Let's assume we generate a doc ref and use that as ID if not provided, 
            // but usually for inventory we might want a readable ID. 
            // For now, let's let Firestore generate the doc ID, and we store it as item_id if not present.

            const docRef = db.collection('items').doc();
            if (!data.item_id) {
                data.item_id = docRef.id;
            }

            await docRef.set(data);
            return { status: 'success', data };
        } catch (error) {
            console.error('Error creating item:', error);
            return { status: 'error', message: error.message };
        }
    },

    updateItem: async (item) => {
        try {
            // We need the doc ID to update. 
            // If item_id is the doc ID, great. If not, we might need to query.
            // In our migration, we used auto-generated doc IDs. 
            // So we need to find the doc where item_id matches, OR we store the doc ID on the client side.
            // Let's assume the client passes the full item object which includes the internal Firestore doc ID if we fetched it properly.
            // But wait, our getItems returns data(), which doesn't include the doc ID unless we map it.
            // Let's check getItems.

            // Checking getItems in current file...
            // It does: let items = snapshot.docs.map(doc => doc.data());
            // This is a problem. We need the doc ID to update efficiently.
            // I should fix getItems first to include the doc ID.

            // But for now, let's assume we will fix getItems.
            const { _docId, ...data } = item; // _docId is convention I'll add

            if (!_docId) {
                // Fallback: Query by item_id
                const snapshot = await db.collection('items').where('item_id', '==', item.item_id).get();
                if (snapshot.empty) throw new Error('Item not found');
                await snapshot.docs[0].ref.update(data);
            } else {
                await db.collection('items').doc(_docId).update(data);
            }

            return { status: 'success', data };
        } catch (error) {
            console.error('Error updating item:', error);
            return { status: 'error', message: error.message };
        }
    },

    getItems: async (options = {}) => {
        try {
            console.log('📡 Fetching items from Firestore...');
            const snapshot = await db.collection('items').get();
            // Include doc ID for updates
            let items = snapshot.docs.map(doc => ({
                _docId: doc.id,
                ...doc.data()
            }));

            // If no items exist (first run), seed them
            if (items.length === 0) {
                console.log('🌱 Seeding initial items...');
                const initialItems = [
                    { item: 'Guest Suite', resource_type: 'GUEST_SUITE', item_id: 'gs-1' },
                    { item: 'Sky Lounge', resource_type: 'SKY_LOUNGE', item_id: 'sl-1' },
                    { item: 'Kayak 1', resource_type: 'GEAR_SHED', item_id: 'kayak-1' },
                    { item: 'Kayak 2', resource_type: 'GEAR_SHED', item_id: 'kayak-2' },
                    { item: 'Mountain Bike 1', resource_type: 'GEAR_SHED', item_id: 'bike-1' },
                    { item: 'Mountain Bike 2', resource_type: 'GEAR_SHED', item_id: 'bike-2' }
                ];

                const batch = db.batch();
                initialItems.forEach(item => {
                    const docRef = db.collection('items').doc();
                    batch.set(docRef, item);
                });
                await batch.commit();
                // Re-fetch to get IDs
                const newSnapshot = await db.collection('items').get();
                items = newSnapshot.docs.map(doc => ({
                    _docId: doc.id,
                    ...doc.data()
                }));
            }

            return { status: 'success', data: items };
        } catch (error) {
            console.error('Error getting items:', error);
            return { status: 'error', message: error.message };
        }
    },

    getStaff: async (options = {}) => {
        try {
            console.log('📡 Fetching staff from Firestore...');
            const snapshot = await db.collection('staff').get();
            let staff = snapshot.docs.map(doc => doc.data());

            // Seed if empty
            if (staff.length === 0) {
                const initialStaff = [
                    { name: 'Staff Member 1' },
                    { name: 'Staff Member 2' }
                ];
                const batch = db.batch();
                initialStaff.forEach(s => {
                    const docRef = db.collection('staff').doc();
                    batch.set(docRef, s);
                });
                await batch.commit();
                staff = initialStaff;
            }

            return { status: 'success', data: staff };
        } catch (error) {
            console.error('Error getting staff:', error);
            return { status: 'error', message: error.message };
        }
    },

    createReservation: async (reservation) => {
        try {
            console.log('Creating reservation:', reservation);
            // Add metadata
            const data = {
                ...reservation,
                created_at: new Date().toISOString(),
                status: 'Scheduled'
            };

            const docRef = await db.collection('reservations').add(data);
            return { status: 'success', data: { tx_id: docRef.id, ...data } };
        } catch (error) {
            console.error('Error creating reservation:', error);
            return { status: 'error', message: error.message };
        }
    },

    updateReservation: async (reservation) => {
        try {
            const { tx_id, ...data } = reservation;
            console.log('Updating reservation:', tx_id, data);

            data.last_update = new Date().toISOString();

            await db.collection('reservations').doc(tx_id).update(data);
            return { status: 'success', data: { tx_id, ...data } };
        } catch (error) {
            console.error('Error updating reservation:', error);
            return { status: 'error', message: error.message };
        }
    },

    cancelReservation: async (tx_id, fee = 0) => {
        try {
            console.log('Cancelling reservation:', tx_id, 'Fee:', fee);
            const updateData = {
                status: 'Cancelled',
                last_update: new Date().toISOString()
            };

            if (fee > 0) {
                updateData.cancellation_fee = fee;
            }

            await db.collection('reservations').doc(tx_id).update(updateData);
            return { status: 'success' };
        } catch (error) {
            console.error('Error cancelling reservation:', error);
            return { status: 'error', message: error.message };
        }
    },

    deleteReservation: async (tx_id) => {
        try {
            console.log('Deleting reservation:', tx_id);
            await db.collection('reservations').doc(tx_id).delete();
            return { status: 'success' };
        } catch (error) {
            console.error('Error deleting reservation:', error);
            return { status: 'error', message: error.message };
        }
    },

    restoreReservation: async (tx_id) => {
        try {
            console.log('Restoring reservation:', tx_id);
            await db.collection('reservations').doc(tx_id).update({
                status: 'Scheduled',
                last_update: new Date().toISOString()
            });
            return { status: 'success' };
        } catch (error) {
            console.error('Error restoring reservation:', error);
            return { status: 'error', message: error.message };
        }
    },



    completeReservation: async (tx_id, return_notes, completed_by) => {
        try {
            console.log('Completing reservation:', tx_id);
            await db.collection('reservations').doc(tx_id).update({
                status: 'Complete',
                return_notes: return_notes,
                completed_by: completed_by,
                last_update: new Date().toISOString()
            });
            return { status: 'success' };
        } catch (error) {
            console.error('Error completing reservation:', error);
            return { status: 'error', message: error.message };
        }
    }
};

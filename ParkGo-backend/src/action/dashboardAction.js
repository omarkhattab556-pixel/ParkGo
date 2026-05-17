import { insertRow, selectRows, updateRows } from "../lib/supabaseRestApi.js";

const ok = (data, message = "OK") => ({
  status: 200,
  body: { success: true, message, data },
});

const fail = (status, message) => ({
  status,
  body: { success: false, message },
});

const toUserMap = (users) =>
  new Map(users.map((user) => [Number(user.id), user]));

const idInFilter = (ids) => `in.(${ids.join(",")})`;

export async function listSubscribersAction() {
  const subscribers = await selectRows("subscriber", {
    select: "*",
    order: "subscriber_num.asc",
  });
  const ids = subscribers.map((subscriber) => Number(subscriber.subscriber_num));

  if (ids.length === 0) {
    return ok({ subscribers: [] });
  }

  const users = await selectRows("user", {
    select: "id,username,first_name,last_name,email,phone_number,user_type",
    filters: { id: idInFilter(ids) },
  });
  const usersById = toUserMap(users);

  return ok({
    subscribers: subscribers.map((subscriber) => {
      const user = usersById.get(Number(subscriber.subscriber_num)) || {};

      return {
        id: subscriber.subscriber_num,
        username: user.username || `${user.first_name || ""} ${user.last_name || ""}`.trim(),
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        email: user.email || "",
        phone: user.phone_number || "",
        registration: subscriber.registration_date,
        delays: subscriber.delay_count,
        status: subscriber.status,
        subscriptionCode: subscriber.subscription_code,
        quickAccessCode: subscriber.quick_access_code,
      };
    }),
  });
}

export async function registerSubscriberAction(payload) {
  const firstName = String(payload.firstName || "").trim();
  const lastName = String(payload.lastName || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const phone = String(payload.phone || "").trim();
  const password = String(payload.password || "123456").trim();

  if (!firstName || !lastName || !email || !password) {
    return fail(400, "First name, last name, email, and password are required.");
  }

  const createdUser = await insertRow("user", {
    username: email.split("@")[0],
    password,
    first_name: firstName,
    last_name: lastName,
    email,
    phone_number: phone || null,
    user_type: "subscriber",
  });

  const createdSubscriber = await insertRow("subscriber", {
    subscriber_num: createdUser.id,
    status: "active",
  });

  return ok(
    {
      subscriber: {
        id: createdSubscriber.subscriber_num,
        username: createdUser.username,
        firstName: createdUser.first_name,
        lastName: createdUser.last_name,
        email: createdUser.email,
        phone: createdUser.phone_number,
        registration: createdSubscriber.registration_date,
        delays: createdSubscriber.delay_count,
        status: createdSubscriber.status,
      },
    },
    "Subscriber registered."
  );
}

export async function listParkingsAction() {
  const parkings = await selectRows("parking", {
    select: "*",
    order: "parking_date.desc",
  });

  return ok({
    parkings: parkings.map((parking) => ({
      code: parking.parking_code,
      space: parking.parking_space,
      startTime: parking.parking_date,
      endTime: parking.retrieval_time,
      confirmation: parking.confirmation_code,
      subscriberId: parking.subscriber_num,
      extensionCount: parking.extension_count,
      maxTimeMinutes: parking.max_time_minutes,
      status: parking.retrieval_time ? "completed" : "active",
    })),
  });
}

export async function listReservationsAction(subscriberId) {
  const filters = {};
  if (subscriberId) filters.subscriber_num = `eq.${subscriberId}`;

  const reservations = await selectRows("reservation", {
    select: "*",
    filters,
    order: "reservation_start.desc",
  });

  return ok({
    reservations: reservations.map((reservation) => ({
      id: reservation.reservation_id,
      subscriberId: reservation.subscriber_num,
      space: reservation.parking_space,
      startTime: reservation.reservation_start,
      endTime: reservation.reservation_end,
      confirmation: reservation.confirmation_code,
      status: reservation.status,
      createdAt: reservation.created_at,
    })),
  });
}

export async function createReservationAction(payload) {
  const subscriberId = Number(payload.subscriberId);
  const reservationStart = payload.reservationStart;

  if (!subscriberId || !reservationStart) {
    return fail(400, "Subscriber and reservation start time are required.");
  }

  const spaces = await selectRows("parking_space", {
    select: "space_number,is_occupied",
    filters: { is_occupied: "eq.false" },
    limit: 1,
    order: "space_number.asc",
  });

  const space = spaces[0];
  if (!space) return fail(409, "No free parking spaces are available.");

  const confirmationCode = Math.floor(100000 + Math.random() * 900000);
  const reservation = await insertRow("reservation", {
    subscriber_num: subscriberId,
    parking_space: space.space_number,
    reservation_start: reservationStart,
    confirmation_code: confirmationCode,
    status: "active",
  });

  return ok(
    {
      reservation: {
        id: reservation.reservation_id,
        subscriberId: reservation.subscriber_num,
        space: reservation.parking_space,
        startTime: reservation.reservation_start,
        endTime: reservation.reservation_end,
        confirmation: reservation.confirmation_code,
        status: reservation.status,
      },
    },
    "Reservation created."
  );
}

export async function cancelReservationAction(payload) {
  const reservationId = Number(payload.reservationId);

  if (!reservationId) return fail(400, "Reservation ID is required.");

  const updated = await updateRows(
    "reservation",
    { status: "cancelled" },
    {
      filters: { reservation_id: `eq.${reservationId}` },
      select: "*",
    }
  );

  if (updated.length === 0) return fail(404, "Reservation not found.");

  return ok({ reservation: updated[0] }, "Reservation cancelled.");
}

export async function verifyPickupAction(payload) {
  const confirmationCode = Number(payload.confirmationCode);

  if (!confirmationCode) return fail(400, "Confirmation code is required.");

  const matchingParking = await selectRows("parking", {
    select: "*",
    filters: { confirmation_code: `eq.${confirmationCode}` },
    limit: 1,
  });

  if (matchingParking.length > 0) {
    return ok({ matchType: "parking", parking: matchingParking[0] }, "Pickup code verified.");
  }

  const matchingReservation = await selectRows("reservation", {
    select: "*",
    filters: { confirmation_code: `eq.${confirmationCode}` },
    limit: 1,
  });

  if (matchingReservation.length > 0) {
    return ok(
      { matchType: "reservation", reservation: matchingReservation[0] },
      "Pickup code verified."
    );
  }

  return fail(404, "Invalid pickup code.");
}

export async function listMessagesAction(userId) {
  const filters = {};
  if (userId) filters.msg_to = `eq.${userId}`;

  const messages = await selectRows("message", {
    select: "*",
    filters,
    order: "sent_at.desc",
  });

  return ok({ messages });
}

export async function reportSummaryAction() {
  const [subscribers, parkings, reservations, spaces] = await Promise.all([
    selectRows("subscriber", { select: "subscriber_num,status" }),
    selectRows("parking", { select: "parking_code,retrieval_time" }),
    selectRows("reservation", { select: "reservation_id,status" }),
    selectRows("parking_space", { select: "space_number,is_occupied" }),
  ]);

  return ok({
    summary: {
      subscribers: subscribers.length,
      activeSubscribers: subscribers.filter((item) => item.status === "active").length,
      parkings: parkings.length,
      activeParkings: parkings.filter((item) => !item.retrieval_time).length,
      reservations: reservations.length,
      activeReservations: reservations.filter((item) => item.status === "active").length,
      spaces: spaces.length,
      occupiedSpaces: spaces.filter((item) => item.is_occupied).length,
    },
  });
}

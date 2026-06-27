import {
  useEffect,
  useMemo,
  useState,
  useRef
} from "react";

import {
  useNavigate,
  useLocation,
} from "react-router-dom";
import axios from "axios";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import API_URL from "./lib/api";
const minDate = new Date().toISOString().split('T')[0];

const timeOptions = [];

for (let hour = 10; hour < 22; hour++) {
  const value = `${String(hour).padStart(2, "0")}:00`;

  const displayHour = hour > 12
    ? hour - 12
    : hour === 0
    ? 12
    : hour;

  const suffix = hour >= 12 ? "PM" : "AM";

  timeOptions.push({
    label: `${displayHour}:00 ${suffix}`,
    value,
  });
}
const endTimeOptions = [
  ...timeOptions,
  {
    label: "10:00 PM",
    value: "22:00",
  },
];

const initialSearch = {
  branchId: '',
  date: minDate,
  startTime: '10:00',
  endTime: '11:00',
};

const initialBookingForm = {
  fullName: '',
  phone: '',
};

const groundNameMap = {
  'Ground A': 'Arena A',
  'Ground B': 'Arena B',
  'Premium Turf': 'Premium Turf',
  'Practice Net': 'Practice Net',
};

const formatTimeLabel = (value) =>
  endTimeOptions.find(option => option.value === value)?.label || value;
const calculateDuration = (startTime, endTime) => {
  const startHour = Number(startTime.split(':')[0]);
  const endHour = Number(endTime.split(':')[0]);
  return Math.max(0, endHour - startHour);
};
const formatDate = (value) =>
  new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const formatCreatedAt = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

const selectedBranchId =
  location.state?.branchId;

const selectedBranchName =
  location.state?.branchName;
  const [branchSummaries, setBranchSummaries] = useState([]);
const [searchData, setSearchData] =
  useState({
    ...initialSearch,
    branchId: selectedBranchId || "",
  });
  const [groundsForBranch, setGroundsForBranch] = useState([]);
  const [availabilityResult, setAvailabilityResult] = useState(null);
  const [selectedGround, setSelectedGround] = useState(null);
  const [bookingForm, setBookingForm] = useState(initialBookingForm);
  const [bookingResult, setBookingResult] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const availabilityCardRef = useRef(null);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/branches`);
        const branchList = response.data || [];

        const summaries = await Promise.all(
          branchList.map(async (branch) => {
            const groundsResponse = await axios.get(`${API_URL}/api/grounds/${branch.id}`);
            return {
              ...branch,
              groundCount: groundsResponse.data?.length || 0,
            };
          })
        );

        setBranchSummaries(summaries);

        if (summaries[0] && !selectedBranchId) {
          setSearchData((prev) => ({
            ...prev,
            branchId: String(summaries[0].id),
          }));
        }
      } catch (err) {
        console.error('Failed to load branches', err);
        setError('We could not load branches right now. Please refresh and try again.');
      }
    };

    loadBranches();
  }, [selectedBranchId]);

  useEffect(() => {
    const loadGrounds = async () => {
      if (!searchData.branchId) {
        setGroundsForBranch([]);
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/api/grounds/${searchData.branchId}`);
        setGroundsForBranch(response.data || []);
      } catch (err) {
        console.error('Failed to load grounds', err);
      }
    };

    loadGrounds();
  }, [searchData.branchId]);

  const selectedBranch = useMemo(() => {
    return branchSummaries.find((branch) => String(branch.id) === String(searchData.branchId)) || null;
  }, [branchSummaries, searchData.branchId]);

  const durationHours = useMemo(() => calculateDuration(searchData.startTime, searchData.endTime), [searchData.startTime, searchData.endTime]);
  const price = useMemo(() => durationHours * 800, [durationHours]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setSearchData((prev) => ({ ...prev, [name]: value }));
    setAvailabilityResult(null);
    setSelectedGround(null);
    setError('');
  };
const handleRecommendedSlot = async () => {
  if (!availabilityResult?.recommendation) return;

  const recommendation = availabilityResult.recommendation;

  const updatedSearch = {
  ...searchData,
  date: recommendation.date,
  startTime: recommendation.startTime,
  endTime: recommendation.endTime,
};

  // Update dropdowns
  setSearchData(updatedSearch);

  // Show loading
  setCheckingAvailability(true);
  setError("");

  try {
    const response = await axios.post(
      `${API_URL}/api/check-availability`,
      {
        branchId: Number(updatedSearch.branchId),
        date: updatedSearch.date,
        startTime: updatedSearch.startTime,
        endTime: updatedSearch.endTime,
      }
    );

    if (response.data.available) {
      const matchedGround =
        groundsForBranch.find((ground) => ground.id === response.data.groundId) || null;

      setSelectedGround(matchedGround || {
        id: response.data.groundId,
        ground_name: response.data.groundName,
      });

      setAvailabilityResult({
        available: true,
        groundName:
          groundNameMap[response.data.groundName] ||
          response.data.groundName,
        groundId: response.data.groundId,
        date: updatedSearch.date,
        startTime: updatedSearch.startTime,
        endTime: updatedSearch.endTime,
        durationHours: calculateDuration(
          updatedSearch.startTime,
          updatedSearch.endTime
        ),
        price:
          calculateDuration(
            updatedSearch.startTime,
            updatedSearch.endTime
          ) * 800,
      });
    } else {
      setAvailabilityResult(response.data);
    }
  } catch (err) {
    console.error(err);
    setError("Unable to check the recommended slot.");
  } finally {
    setCheckingAvailability(false);
  }
};
  const handleCheckAvailability = async (event) => {
  event.preventDefault();

  if (
    !searchData.branchId ||
    !searchData.date ||
    !searchData.startTime ||
    !searchData.endTime
  ) {
    setError("Please choose a branch, date and time to continue.");
    return;
  }

  if (durationHours <= 0) {
    setError("Please select an end time after the start time.");
    return;
  }

  setCheckingAvailability(true);
  setError("");
  setAvailabilityResult(null);
  setSelectedGround(null);

  try {
    const availabilityResponse = await axios.post(
      `${API_URL}/api/check-availability`,
      {
        branchId: Number(searchData.branchId),
        date: searchData.date,
        startTime: searchData.startTime,
        endTime: searchData.endTime,
      }
    );

    const isAvailable = Boolean(availabilityResponse.data?.available);

    if (isAvailable) {
      const groundToSelect =
        groundsForBranch.find((ground) => ground.id === availabilityResponse.data.groundId) || {
          id: availabilityResponse.data.groundId,
          ground_name: availabilityResponse.data.groundName,
        };

      setSelectedGround(groundToSelect);

      setAvailabilityResult({
        available: true,
        groundName:
          groundNameMap[availabilityResponse.data.groundName] ||
          availabilityResponse.data.groundName,
        groundId: availabilityResponse.data.groundId,
        date: searchData.date,
        startTime: searchData.startTime,
        endTime: searchData.endTime,
        durationHours,
        price,
      });
    } else {
      setAvailabilityResult(availabilityResponse.data);
    }
  } catch (err) {
    console.error("Failed to check availability", err);
    setError(
      "We could not check availability right now. Please try again."
    );
  } finally {
    setCheckingAvailability(false);
    setTimeout(() => {
  availabilityCardRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}, 300);
}
};

  const openBookingModal = () => {
    if (!availabilityResult?.available) return;
    setModalOpen(true);
    setBookingResult(null);
    setError('');
  };

  const handleBookingInput = (event) => {
    const { name, value } = event.target;
    setBookingForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBookingSubmit = async (event) => {
    event.preventDefault();
    if (!selectedGround || !availabilityResult?.available) return;

    setSubmittingBooking(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

if (!token) {
  setError('Please login before making a booking.');
  return;
}

const response = await axios.post(
  `${API_URL}/api/bookings`,
  {
    customer_name: currentUser.full_name || bookingForm.fullName,
    phone: bookingForm.phone,
    branch_id: Number(searchData.branchId),
    booking_date: searchData.date,
    start_time: searchData.startTime,
    end_time: searchData.endTime,
  },
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);

      const confirmedBooking = response.data?.booking || {};
      setBookingResult({
        bookingId: confirmedBooking.id,
        customerName: confirmedBooking.customerName || bookingForm.fullName,
        branchName: selectedBranch?.branch_name || 'Eagle Box Cricket',
        groundName: confirmedBooking.groundName ? groundNameMap[confirmedBooking.groundName] || confirmedBooking.groundName : 'Selected Ground',
        date: confirmedBooking.date || searchData.date,
        startTime: confirmedBooking.startTime || searchData.startTime,
        endTime: confirmedBooking.endTime || searchData.endTime,
        price: confirmedBooking.amount || price,
        status: confirmedBooking.status || 'confirmed',
        createdAt: confirmedBooking.createdAt,
      });

      setModalOpen(false);
      setAvailabilityResult(null);
      setSelectedGround(null);
    } catch (err) {
      console.error('Booking failed', err);
      setError(err?.response?.data?.error || 'Your booking could not be confirmed. Please try another slot.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8f4] text-slate-950">
      <Navbar />

      <main className="relative z-20 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700 shadow-sm">{error}</div>
        ) : null}

        {bookingResult ? (
          <section className="mb-8">
            <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl shadow-emerald-900/10">
              <div className="bg-slate-950 px-5 py-5 text-white sm:px-7">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">Booking confirmed</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-black sm:text-3xl">Your cricket slot is ready</h2>
                    <p className="mt-2 text-sm text-slate-300">A confirmation email with the same ticket details has been sent.</p>
                  </div>
                  <div className="rounded-xl bg-white/10 px-4 py-3 text-sm font-black">
                    #{bookingResult.bookingId}
                  </div>
                </div>
              </div>

              <div className="grid gap-0 md:grid-cols-[1fr_auto]">
                <div className="p-5 sm:p-7">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Customer Name", bookingResult.customerName],
                      ["Branch", bookingResult.branchName],
                      ["Ground", bookingResult.groundName],
                      ["Date", formatDate(bookingResult.date)],
                      ["Time", `${formatTimeLabel(bookingResult.startTime)} - ${formatTimeLabel(bookingResult.endTime)}`],
                      ["Status", bookingResult.status],
                      ["Booking Created Time", formatCreatedAt(bookingResult.createdAt)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
                        <p className="mt-2 break-words text-sm font-black capitalize text-slate-950 sm:text-base">{value || "-"}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 bg-emerald-50 p-5 md:w-56 md:border-l md:border-t-0">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Amount paid</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">Rs. {Number(bookingResult.price || 0).toLocaleString("en-IN")}</p>
                  <button
                    onClick={() => navigate(`/cancel-request/${bookingResult.bookingId}`)}
                    className="mt-5 w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-700 hover:bg-red-50"
                  >
                    Request cancellation
                  </button>
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
                  >
                    View dashboard
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section id="booking" className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div
  
  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Book your slot</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">
  Plan your cricket session
</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
  Choose your date and preferred time. We will confirm the ground before booking.
</p>

            <form onSubmit={handleCheckAvailability} className="mt-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">

  <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
    Venue
  </div>

  <div className="mt-2 text-lg font-semibold text-slate-900">
    Eagle Box Cricket - {selectedBranchName || selectedBranch?.branch_name || "Select branch"}
  </div>

</div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">Date</label>
                <input
                  type="date"
                  name="date"
                  required
                  min={minDate}
                  value={searchData.date}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">Start Time</label>
                  <select
                    name="startTime"
                    value={searchData.startTime}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600"
                  >{timeOptions
  .filter(option => option.value !== "22:00")
  .map((option) => (
                    
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">End Time</label>
                  <select
  name="endTime"
  value={searchData.endTime}
  onChange={handleChange}
  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600"
>
  {endTimeOptions
    .filter((option) => option.value > searchData.startTime)
    .map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
</select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
  Duration
</div>
                  <div className="mt-2 text-lg font-semibold text-black">
                    {durationHours > 0 ? `${durationHours} hour${durationHours > 1 ? 's' : ''}` : 'Select a time'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                 <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
  Price
</div>
                  <div className="mt-2 text-lg font-semibold text-black">
  Rs. {price}
</div>
                </div>
              </div>

              <button
                type="submit"
                disabled={checkingAvailability}
                className="w-full rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {checkingAvailability ? 'Checking...' : 'Check Availability'}
              </button>
            </form>
          </div>

          <div
  ref={availabilityCardRef}
  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Availability</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">
  Live Availability
</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Results update with your selected branch, date and time.</p>

            {checkingAvailability ? (
              <div className="mt-6 animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="h-4 w-1/2 rounded bg-slate-200" />
                <div className="mt-4 h-10 rounded bg-slate-200" />
                <div className="mt-3 h-10 rounded bg-slate-200" />
              </div>
            ) : null}

            

            {availabilityResult?.available ? (
              <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Ground available</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">{availabilityResult.groundName}</h3>

                <div className="mt-5 space-y-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                    <span>Date</span>
                    <span className="font-semibold text-slate-900">{availabilityResult.date}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                    <span>Time</span>
                    <span className="font-semibold text-slate-900">{formatTimeLabel(availabilityResult.startTime)} - {formatTimeLabel(availabilityResult.endTime)}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                    <span>Duration</span>
                    <span className="font-semibold text-slate-900">{availabilityResult.durationHours} hour{availabilityResult.durationHours > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Price</span>
                    <span className="font-semibold text-slate-900">Rs. {availabilityResult.price}</span>
                  </div>
                </div>

                <button
  type="button"
  onClick={() => {
    const token = localStorage.getItem('token');

    if (!token) {
      window.location.href = '/login';
      return;
    }

    openBookingModal();
  }}
  className="mt-6 w-full rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
>
  Continue Booking
</button>
              </div>
            ) : null}

           {availabilityResult && !availabilityResult.available ? (
  <div className="mt-6 rounded-2xl border border-yellow-300 bg-yellow-50 p-6">

    <p className="text-lg font-bold text-red-600">
      No grounds available
    </p>
<p className="mt-2 text-slate-700">
  {availabilityResult.error}
</p>

   {availabilityResult.recommendation && (
  <div className="mt-5 rounded-xl bg-white p-4 border border-green-200">

    <h3 className="font-bold text-green-700">
      Recommended Slot
    </h3>

    <p className="mt-2 text-black">
      <b>Ground:</b>{" "}
      {availabilityResult.recommendation?.groundName}
    </p>

    <p className="text-black">
      <b>Date:</b>{" "}
      {availabilityResult.recommendation?.date}
    </p>

    <p className="text-black">
      <b>Time:</b>{" "}
      {formatTimeLabel(
        availabilityResult.recommendation?.startTime
      )}
      {" - "}
      {formatTimeLabel(
        availabilityResult.recommendation?.endTime
      )}
    </p>
<button
  className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
  onClick={handleRecommendedSlot}
>
  Book This Recommended Slot
</button>
  </div>
)}

  </div>
) : null}
          </div>
        </section>
        
      </main>

     <Footer />

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">Booking details</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Confirm your booking</h3>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-full bg-slate-100 px-3 py-1 text-xl font-black text-slate-600 transition hover:bg-slate-200">
                X
              </button>
            </div>

            <form onSubmit={handleBookingSubmit} className="mt-6 space-y-4">
              <div>
  <label className="mb-2 block text-sm font-semibold text-slate-700">
    Phone Number
  </label>

  <input
    type="tel"
    name="phone"
    required
    placeholder="Enter your phone number"
    value={bookingForm.phone}
    onChange={handleBookingInput}
    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600"
  />
</div>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
  <div className="font-semibold text-slate-900">
    Booking For
  </div>

  <div className="mt-2">
    {currentUser.full_name}
  </div>

  <div>
    {currentUser.email}
  </div>
</div>

              <button
                type="submit"
                disabled={submittingBooking}
                className="w-full rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submittingBooking ? 'Processing...' : 'Confirm Booking'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

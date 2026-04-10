import { getCurrentProfile, renderNav } from "../common.js";

await renderNav();

try {
	const profile = await getCurrentProfile();
	const doctorsCta = document.querySelector('a[href="doctors.html"]');

	if (profile?.role === "doctor" && doctorsCta) {
		doctorsCta.remove();
	}
} catch {
	// ignore homepage CTA tweaks if profile can't be loaded
}
